import { Injectable } from '@nestjs/common'
import { basename, dirname, extname, join, resolve } from 'path'
import type { PDFOptions } from 'puppeteer-core'
import { parse as parseYaml } from 'yaml'

import { I18nService } from './i18n.service.js'
import { MarkdownService } from './markdown.service.js'
import { RendererService } from './renderer/renderer.service.js'
import { SignatureService } from './signature/signature.service.js'
import { inlineHtml } from './template/assets.js'
import { TemplateService } from './template/template.service.js'
import { FileSystemService, LoggerService, merge, MergeStrategy } from '@cenk1cenk2/oclif-common'
import { DEFAULT_HIGHLIGHT_STYLE, DEFAULT_LANGUAGE, DEFAULT_PDF_OPTIONS, DEFAULT_TEMPLATE, Directory, InputFileType, MediaType, OutputFileType } from '@constants'
import type { MdPrinterCtx, MdPrinterFlags, MdPrinterInput, MdPrinterOptions, MdPrinterSignOptions, PrinterOutput, RenderedDocument, TemplateBundle } from '@interfaces'

@Injectable()
export class PrinterService {
  constructor(
    private readonly fs: FileSystemService,
    private readonly logger: LoggerService,
    private readonly i18n: I18nService,
    private readonly markdown: MarkdownService,
    private readonly template: TemplateService,
    private readonly renderer: RendererService,
    private readonly signature: SignatureService
  ) {
    this.logger.setup(this.constructor.name)
  }

  public async input(flags: MdPrinterFlags): Promise<MdPrinterInput> {
    let file: string | undefined
    let source: string

    if (flags.file) {
      file = resolve(flags.file)

      if (!this.fs.exists(file)) {
        throw new Error(`File does not exist: ${file}`)
      }

      source = await this.fs.read(file)
    } else if (flags.stdin !== undefined) {
      source = flags.stdin
    } else {
      throw new Error('Either --stdin or file argument must be provided.')
    }

    const type = flags.inputFiletype ?? (file ? extname(file).replace(/^\./, '') : InputFileType.MARKDOWN)

    if (type === InputFileType.YAML || type === InputFileType.YAML_SHORT) {
      return {
        file,
        directory: file ? dirname(file) : process.cwd(),
        content: '',
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
    const template = this.template.resolve(flags.template ?? data.template ?? DEFAULT_TEMPLATE)
    const settings = await this.template.settings(template)
    const output = (flags.outputFiletype ?? data.outputFiletype ?? OutputFileType.PDF) as OutputFileType

    if (!Object.values(OutputFileType).includes(output)) {
      throw new Error(`Output file type is not supported: ${output}, use one of ${Object.values(OutputFileType).join(', ')}.`)
    }

    const dest = flags.stdout ? undefined : (flags.output ?? data.dest ?? (input.file ? `${basename(input.file, extname(input.file))}.${output}` : undefined))

    return {
      template,
      output,
      dest: dest && resolve(dest),
      title: flags.title ?? data.documentTitle,
      language: flags.language ?? data.language ?? settings.i18n?.language ?? DEFAULT_LANGUAGE,
      continuous: flags.continuous || data.continuous === true || settings.continuous === true,
      media: (settings.media ?? MediaType.SCREEN) as MediaType,
      highlight: settings.highlightStyle ?? DEFAULT_HIGHLIGHT_STYLE,
      pdf: this.pdfOptions(settings.pdfOptions, data.pdfOptions),
      i18n: settings.i18n ?? {},
      sign: this.signOptions(flags, settings.sign, data.sign)
    }
  }

  public bundle(options: MdPrinterOptions): Promise<TemplateBundle> {
    return this.template.bundle(options.template)
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
        content: input.content,
        t: await this.i18n.load(join(options.template, Directory.I18N), { ...options.i18n, language: options.language }),
        language: options.language,
        signature: ctx.signature
      },
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
      const { content, assets } = await inlineHtml(document.html, ctx.input.directory, { confined: true })

      return { content: Buffer.from(content), assets }
    }

    const { pdf, assets } = await this.renderer.render(document, {
      directory: ctx.input.directory,
      pdf: ctx.options.pdf,
      media: ctx.options.media,
      continuous: ctx.options.continuous
    })

    return { content: pdf, assets }
  }

  public sign(ctx: MdPrinterCtx, pdf: Buffer): Promise<Buffer> {
    return this.signature.sign(pdf, {
      ...ctx.options.sign,
      date: ctx.signingTime,
      certificate: ctx.certificate
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
    const pdf = merge<PDFOptions>(MergeStrategy.EXTEND, {}, DEFAULT_PDF_OPTIONS, ...sources.map((source) => source ?? {}))

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
