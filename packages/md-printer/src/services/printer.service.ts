import { Injectable } from '@nestjs/common'
import { cloneDeep, mergeWith, uniq } from 'es-toolkit'
import { basename, dirname, extname, join, resolve } from 'path'
import type { PDFOptions } from 'puppeteer-core'
import { parse as parseYaml } from 'yaml'

import { I18nService } from './i18n.service.js'
import { MarkdownService } from './markdown.service.js'
import { PdfService } from './pdf/pdf.service.js'
import { DestSchema } from './printer.schema.js'
import { RendererService } from './renderer/renderer.service.js'
import { SignatureVerificationError } from './signature/cms.js'
import { SignatureService } from './signature/signature.service.js'
import { inlineHtml } from './template/assets.js'
import type { TemplateSource } from './template/template.schema.js'
import { issues, TemplateSourceSchema } from './template/template.schema.js'
import { TemplateService } from './template/template.service.js'
import { ConfigService, FileSystemService, LoggerService } from '@cenk1cenk2/oclif-common'
import {
  AttachmentPosition,
  DEFAULT_HIGHLIGHT_STYLE,
  DEFAULT_LANGUAGE,
  DEFAULT_PDF_OPTIONS,
  DEFAULT_TEMPLATE,
  InputFileType,
  MediaType,
  OutputFileType,
  TemplateSourceType
} from '@constants'
import type {
  MdPrinterAttachment,
  MdPrinterCtx,
  MdPrinterFlags,
  MdPrinterInput,
  MdPrinterOptions,
  MdPrinterSignOptions,
  PrinterOutput,
  RenderedDocument,
  TemplateBundle
} from '@interfaces'

@Injectable()
export class PrinterService {
  constructor(
    private readonly fs: FileSystemService,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
    private readonly markdown: MarkdownService,
    private readonly template: TemplateService,
    private readonly renderer: RendererService,
    private readonly pdf: PdfService,
    private readonly signature: SignatureService
  ) {
    this.logger.setup(this.constructor.name)
  }

  public async input(flags: MdPrinterFlags): Promise<MdPrinterInput> {
    let file: string | undefined
    let source: string

    if (flags.file !== undefined) {
      file = resolve(flags.file)

      if (!this.fs.exists(file)) {
        throw new Error(`File does not exist: ${file}`)
      }

      source = await this.fs.read(file)
    } else {
      source = flags.stdin
    }

    const type = flags.inputFiletype ?? (file ? extname(file).replace(/^\./, '') : InputFileType.MARKDOWN)

    if (type === InputFileType.YAML || type === InputFileType.YAML_SHORT) {
      return {
        file,
        directory: file ? dirname(file) : process.cwd(),
        markdown: { type: 'root', children: [] },
        data: parseYaml(source) ?? {}
      }
    }

    // any other extension is read as markdown, like .markdown, .txt or none at all
    return {
      file,
      directory: file ? dirname(file) : process.cwd(),
      ...this.markdown.parse(source)
    }
  }

  public async options(flags: MdPrinterFlags, input: MdPrinterInput): Promise<MdPrinterOptions> {
    const { data } = input
    const source = this.templateSource(this.templateFlags(flags) ?? data.template) ?? DEFAULT_TEMPLATE
    const { directory: template, settings, files } = await this.template.resolve(source, input.directory)
    const output = (flags.outputFiletype ?? data.outputFiletype ?? OutputFileType.PDF) as OutputFileType

    if (!Object.values(OutputFileType).includes(output)) {
      throw new Error(`Output file type is not supported: ${output}, use one of ${Object.values(OutputFileType).join(', ')}.`)
    }

    const dest = flags.stdout ? undefined : (flags.output ?? this.dest(data.dest, input.file && `${basename(input.file, extname(input.file))}.${output}`))

    return {
      template,
      files,
      output,
      dest: dest && resolve(dest),
      title: flags.title ?? data.documentTitle,
      language: flags.language ?? data.language ?? settings.i18n?.language ?? DEFAULT_LANGUAGE,
      continuous: flags.continuous || data.continuous === true || settings.continuous === true,
      media: (settings.media ?? MediaType.SCREEN) as MediaType,
      highlight: settings.highlightStyle ?? DEFAULT_HIGHLIGHT_STYLE,
      pdf: this.pdfOptions(settings.pdfOptions, data.pdfOptions),
      i18n: settings.i18n ?? {},
      sign: this.signOptions(flags, settings.sign, data.sign),
      attachments: this.attachments(data.attachments),
      compress: data.compress === true
    }
  }

  public bundle(options: MdPrinterOptions): Promise<TemplateBundle> {
    return this.template.bundle(options.files)
  }

  /**
   * Resolves the signing time and the visible signature description, which the template renders before the document is signed.
   */
  public async prepare(ctx: MdPrinterCtx): Promise<void> {
    if (!ctx.options.sign.enabled) {
      return
    }

    if (ctx.options.output !== OutputFileType.PDF) {
      throw new Error('Signing is only supported for PDF output.')
    }

    this.signature.adapter(ctx.options.sign.provider)

    ctx.signingTime = new Date()
    ctx.certificate = ctx.options.sign.certificate ? await this.signature.certificate(ctx.options.sign.certificate, ctx.signingTime) : undefined
    ctx.signature = this.signature.describe(ctx.signingTime, ctx.certificate)
  }

  public async document(ctx: MdPrinterCtx, bundle: TemplateBundle): Promise<RenderedDocument> {
    const { input, options } = ctx
    const document = await this.template.render(
      options.template,
      bundle,
      {
        data: input.data,
        t: await this.i18n.load(options.files.i18n, { ...options.i18n, language: options.language }),
        language: options.language,
        signature: ctx.signature
      },
      this.markdown.resolve(input.markdown, bundle.directives),
      {
        language: options.language,
        title: options.title,
        fallbackTitle: input.file && basename(input.file, extname(input.file)),
        highlight: options.highlight
      }
    )

    this.logger.debug('Rendered document: %d bytes, header: %d bytes, footer: %d bytes', document.html.length, document.header?.length ?? 0, document.footer?.length ?? 0)

    return document
  }

  public async output(ctx: MdPrinterCtx, document: RenderedDocument): Promise<PrinterOutput> {
    if (ctx.options.output === OutputFileType.HTML) {
      if (ctx.options.attachments.length || ctx.options.compress) {
        throw new Error('Attachments and compression are only supported for PDF output.')
      }

      const { content, assets } = await inlineHtml(document.html, ctx.input.directory, { confined: true })

      return { content: Buffer.from(content), assets }
    }

    const { pdf, assets } = await this.renderer.render(document, {
      directory: ctx.input.directory,
      pdf: ctx.options.pdf,
      media: ctx.options.media,
      continuous: ctx.options.continuous
    })

    const processed = await this.pdf.process(pdf, {
      directory: ctx.input.directory,
      attachments: ctx.options.attachments,
      compress: ctx.options.compress
    })

    return { content: processed.pdf, assets: [...assets, ...processed.assets] }
  }

  public sign(ctx: MdPrinterCtx, pdf: Buffer): Promise<Buffer> {
    return this.signature
      .sign(pdf, {
        ...ctx.options.sign,
        date: ctx.signingTime,
        certificate: ctx.certificate
      })
      .catch(async(err: unknown) => {
        if (err instanceof SignatureVerificationError && this.config.isDebug && ctx.options.dest) {
          const path = `${ctx.options.dest}.cms.der`

          await this.fs.write(path, err.cms)

          this.logger.debug('The returned signature is written to: %s', path)
        }

        throw err
      })
  }

  private templateFlags({ template, templateType, templateDirectory }: MdPrinterFlags): unknown {
    if (!templateType) {
      return template
    }

    return {
      type: templateType,
      [templateType === TemplateSourceType.DIRECTORY ? 'path' : 'name']: template,
      ...(templateDirectory !== undefined && { directory: templateDirectory })
    }
  }

  private templateSource(value: unknown): string | TemplateSource | undefined {
    if (value === undefined || value === null) {
      return undefined
    }

    if (typeof value === 'string') {
      return value
    }

    const { success, data, error } = TemplateSourceSchema.safeParse(value)

    if (!success) {
      throw new Error(`Template is invalid: ${issues(error)}`)
    }

    return data
  }

  private dest(value: unknown, filename?: string): string | undefined {
    if (value === undefined || value === null) {
      return filename
    }

    if (typeof value === 'string') {
      return value
    }

    const { success, data, error } = DestSchema.safeParse(value)

    if (!success) {
      throw new Error(`Dest is invalid: ${issues(error)}`)
    }

    if (!data.filename && !filename) {
      throw new Error('Dest needs a filename when there is no input file to name the output after.')
    }

    return join(data.directory ?? '.', data.filename ?? filename)
  }

  private attachments(value: unknown): MdPrinterAttachment[] {
    if (value === undefined || value === null) {
      return []
    }

    if (!Array.isArray(value)) {
      throw new Error('Front-matter attachments must be a list of { file, position, compress }.')
    }

    return value.map((attachment, index) => {
      if (typeof attachment?.file !== 'string' || !attachment.file) {
        throw new Error(`Attachment ${index + 1} needs a file path or URL.`)
      }

      const position = attachment.position ?? AttachmentPosition.AFTER

      if (!Object.values(AttachmentPosition).includes(position) && !(Number.isInteger(position) && position >= 1)) {
        throw new Error(`Attachment ${attachment.file} has an invalid position: ${position}, use ${Object.values(AttachmentPosition).join(', ')} or a page number.`)
      }

      return {
        file: attachment.file,
        position,
        compress: attachment.compress === true
      }
    })
  }

  private signOptions(flags: MdPrinterFlags, ...sources: MdPrinterSignOptions[]): MdPrinterSignOptions {
    return {
      ...Object.assign({}, ...sources),
      ...(flags.sign ? { enabled: true } : {}),
      ...(flags.signProvider ? { provider: flags.signProvider } : {}),
      ...(flags.signCertificate ? { certificate: flags.signCertificate } : {})
    }
  }

  private pdfOptions(...sources: PDFOptions[]): PDFOptions {
    const pdf = sources.reduce<PDFOptions>(
      (merged, source) => mergeWith(merged, source ?? {}, (current, value) => (Array.isArray(current) && Array.isArray(value) ? uniq([...current, ...value]) : undefined)),
      cloneDeep(DEFAULT_PDF_OPTIONS)
    )

    // Puppeteer only takes margin objects, settings and front-matter may use the CSS shorthand
    if (typeof pdf.margin === 'string') {
      const [top, right = top, bottom = top, left = right] = (pdf.margin as string).trim().split(/\s+/)

      pdf.margin = {
        top,
        right,
        bottom,
        left
      }
    }

    return pdf
  }
}
