import { watch } from 'chokidar'
import { default as graymatter } from 'gray-matter'
import { mdToPdf } from 'md-to-pdf'
import type { PdfConfig } from 'md-to-pdf/dist/lib/config.js'
import type { PdfOutput } from 'md-to-pdf/dist/lib/generate-output.js'
import Nunjucks from 'nunjucks'
import { basename, dirname, extname, join } from 'path'
import postcss from 'postcss'
import showdown from 'showdown'
import tailwind from 'tailwindcss'

import type { ShouldRunAfterHook, ShouldRunBeforeHook } from '@cenk1cenk2/oclif-common'
import { Args, Flags, Command, ConfigService, FileSystemService, ParserService, JsonParser, YamlParser } from '@cenk1cenk2/oclif-common'
import { OUTPUT_FILE_ACCEPTED_TYPES, RequiredTemplateFiles, TEMPLATE_DIRECTORY, TemplateFiles } from '@constants'
import type { MdPrinterCtx } from '@interfaces'

export default class MDPrinter extends Command<typeof MDPrinter, MdPrinterCtx> implements ShouldRunBeforeHook, ShouldRunAfterHook {
  static description = 'Generates a PDF from the given markdown file with the selected HTML template.'

  static flags = {
    template: Flags.string({
      char: 't',
      default: 'default',
      description: 'HTML template for the generated PDF file.'
    }),
    title: Flags.string({
      char: 'T',
      description: 'Overwrite document title.'
    }),
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch the changes on the given file.'
    }),
    dev: Flags.boolean({
      char: 'd',
      description: 'Run with Chrome browser instead of publishing the file.'
    })
  }

  static args = {
    file: Args.string({
      description: 'File to be processed.',
      required: true
    }),
    output: Args.string({
      description: 'Output file that will be generated. Overwrites the one define in front-matter.',
      required: false
    })
  }

  private nunjucks = Nunjucks.configure({
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: false
  })
  private cs: ConfigService
  private fs: FileSystemService

  public async shouldRunBefore(): Promise<void> {
    this.cs = this.app.get(ConfigService)
    this.fs = this.app.get(FileSystemService)

    await this.app.get(ParserService).register(JsonParser, YamlParser)

    this.nunjucks.addFilter('markdown_to_html', (markdown: string) => {
      return new showdown.Converter().makeHtml(markdown)
    })
    this.tasks.options = { silentRendererCondition: true }
  }

  public async run(): Promise<void> {
    this.tasks.add([
      {
        task: async(ctx): Promise<void> => {
          const file = join(process.cwd(), this.args.file)

          if (!this.fs.exists(file)) {
            throw new Error(`File does not exists: ${file}`)
          }

          this.logger.debug('Loading file: %s', file)

          ctx.file = file
          switch (extname(ctx.file)) {
            case '.md': {
              const data = graymatter.read(ctx.file)

              ctx.content = await this.fs.read(file)
              ctx.content = data.content

              ctx.metadata = data.data

              break
            }

            case '.yml': {
              ctx.content = await this.fs.read(file)

              ctx.metadata = await this.app.get(ParserService).parse(ctx.file, ctx.content)

              break
            }

            default:
              throw new Error('File type is not accepted.')
          }
        }
      },

      {
        task: async(ctx): Promise<void> => {
          const template = ctx.metadata?.template ?? this.flags.template

          this.logger.debug('Loading template: %s', template)

          ctx.templates = new RegExp(/\.\.?\//).test(template) ? join(process.cwd(), template) : join(this.config.root, TEMPLATE_DIRECTORY, template)

          await Promise.all(
            RequiredTemplateFiles.map(async(file) => {
              const current = join(ctx.templates, file)

              if (!this.fs.exists(current)) {
                throw new Error(`Template does not exists: ${current}`)
              }
            })
          )

          const paths: Record<TemplateFiles, string> = {
            [TemplateFiles.SETTINGS]: join(ctx.templates, TemplateFiles.SETTINGS),
            [TemplateFiles.CSS]: join(ctx.templates, TemplateFiles.CSS),
            [TemplateFiles.TAILWIND_CSS]: join(ctx.templates, TemplateFiles.TAILWIND_CSS),
            [TemplateFiles.TAILWIND_CONFIG]: join(ctx.templates, TemplateFiles.TAILWIND_CONFIG),
            [TemplateFiles.HEADER]: join(ctx.templates, TemplateFiles.HEADER),
            [TemplateFiles.FOOTER]: join(ctx.templates, TemplateFiles.FOOTER),
            [TemplateFiles.TEMPLATE]: join(ctx.templates, TemplateFiles.TEMPLATE)
          }

          ctx.options = await this.cs.extend<PdfConfig>([
            paths[TemplateFiles.SETTINGS],
            {
              dest: this.args?.output ?? ctx.metadata?.dest ?? `${basename(this.args.file, extname(this.args.file))}.pdf`,
              document_title: ctx.metadata?.document_title ?? this.flags.title ?? this.args.file
              // https://github.com/simonhaenisch/md-to-pdf/issues/247
              // launch_options: {
              //   headless: true
              // }
            }
          ])

          this.logger.debug('Options: %o', ctx.options)

          if (this.fs.exists(paths[TemplateFiles.HEADER])) {
            this.logger.debug('Header exists for template.')

            ctx.options.pdf_options.headerTemplate = await this.fs.read(paths[TemplateFiles.HEADER])
          }

          if (this.fs.exists(paths[TemplateFiles.FOOTER])) {
            this.logger.debug('Footer exists for template.')

            ctx.options.pdf_options.footerTemplate = await this.fs.read(paths[TemplateFiles.FOOTER])
          }

          if (this.fs.exists(paths[TemplateFiles.TEMPLATE])) {
            this.logger.debug('Design template exists for template.')

            ctx.template = await this.fs.read(paths[TemplateFiles.TEMPLATE])

            this.logger.debug('Metadata: %o', ctx.metadata)
          }

          if (this.fs.exists(paths[TemplateFiles.CSS])) {
            this.logger.debug('CSS exists for template.')
            ctx.options.css = await this.fs.read(paths[TemplateFiles.CSS])
          }

          if (this.fs.exists(paths[TemplateFiles.TAILWIND_CSS])) {
            this.logger.debug('Tailwind CSS exists for template, generating configuration from: %s -> %s', paths[TemplateFiles.TAILWIND_CONFIG], paths[TemplateFiles.TAILWIND_CSS])

            ctx.options.css = await postcss([
              tailwind({
                ...(await import(paths[TemplateFiles.TAILWIND_CONFIG]).then((m) => m.default)),
                content: [ { raw: ctx.template, extension: 'html' } ]
              })
            ])
              .process(await this.fs.read(paths[TemplateFiles.TAILWIND_CSS]), { from: undefined })
              .then((result) => result.css)
          }
        }
      },

      {
        task: async(ctx): Promise<void> => {
          if (this.flags.dev) {
            ctx.options.devtools = true

            this.logger.info('Running in dev mode.')
          }
        }
      }
    ])
  }

  public async shouldRunAfter(ctx: MdPrinterCtx): Promise<void> {
    if (this.flags.watch) {
      this.logger.info('Running in watch mode.')

      watch([TEMPLATE_DIRECTORY, this.args.file, join(ctx.templates, '**/*')]).on('change', async() => {
        await this.run()
        await this.runTasks()

        this.logger.info('Waiting for the next change.')

        return this.runMd2Pdf(ctx)
      })
    }

    return this.runMd2Pdf(ctx)
  }

  private async runMd2Pdf(ctx: MdPrinterCtx): Promise<void> {
    let pdf: PdfOutput

    if (ctx.template) {
      this.logger.debug('Rendering as template.')
      pdf = await mdToPdf({ content: this.nunjucks.renderString(ctx.template, { ...(ctx.metadata ?? {}), content: ctx.content }) }, ctx.options)
    } else {
      this.logger.debug('Rendering as plain file.')
      pdf = await mdToPdf({ content: ctx.content }, ctx.options)
    }

    const output = pdf.filename

    await this.fs.mkdir(dirname(output))

    if (!output) {
      throw new Error('Output should either be defined with the variable or front-matter.')
    } else if (!OUTPUT_FILE_ACCEPTED_TYPES.includes(extname(output))) {
      throw new Error(`Output file should be ending with the extension: ${OUTPUT_FILE_ACCEPTED_TYPES.join(', ')} -> current: ${extname(output)}`)
    }

    this.logger.debug('Output file will be: %s', output)

    if (pdf) {
      this.logger.info('Writing file to output: %s', output)

      await this.fs.write(output, pdf.content)
    }
  }
}
