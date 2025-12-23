import tailwind from '@tailwindcss/postcss'
import { watch } from 'chokidar'
import { default as graymatter } from 'gray-matter'
import type { Config as MdToPdfConfig } from 'md-to-pdf/dist/lib/config.js'
import { defaultConfig as MdToPdfDefaultConfig } from 'md-to-pdf/dist/lib/config.js'
import type { HtmlOutput, PdfOutput } from 'md-to-pdf/dist/lib/generate-output.js'
import { convertMdToPdf } from 'md-to-pdf/dist/lib/md-to-pdf.js'
import { serveDirectory } from 'md-to-pdf/dist/lib/serve-dir.js'
import type { AddressInfo } from 'net'
import Nunjucks from 'nunjucks'
import { basename, dirname, extname, isAbsolute, join } from 'path'
import postcss from 'postcss'
import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'
import showdown from 'showdown'

import type { ShouldRunAfterHook, ShouldRunBeforeHook } from '@cenk1cenk2/oclif-common'
import {
  Args, Flags, Command, ConfigService, FileSystemService, ParserService, JsonParser, YamlParser, merge, MergeStrategy
} from '@cenk1cenk2/oclif-common'
import { InputFileType, OutputFileType, RequiredTemplateFiles, TEMPLATE_DIRECTORY, TemplateFiles } from '@constants'
import type { MdPrinterCtx } from '@interfaces'

export default class MDPrinter extends Command<typeof MDPrinter, MdPrinterCtx> implements ShouldRunBeforeHook, ShouldRunAfterHook {
  static description = 'Generates a PDF from the given markdown file with the selected HTML template.'

  static flags = {
    stdin: Flags.string({
      char: 'I',
      description: 'Read the input from stdin.',
      required: false,
      exclusive: ['file'],
      allowStdin: 'only'
    }),
    // stdin: Flags.boolean({
    //   char: 'I',
    //   description: 'Read the input from stdin.',
    //   required: false,
    //   default: false
    // }),
    ['input-filetype']: Flags.string({
      char: 'f',
      options: Object.values(InputFileType),
      description: 'File type to be processed. By default it is detected by the file extension.',
      default: InputFileType.MARKDOWN
    }),
    ['output-filetype']: Flags.string({
      char: 'F',
      options: Object.values(OutputFileType),
      description: 'File type to be processed. By default it is detected by the file extension.',
      default: OutputFileType.PDF
    }),
    stdout: Flags.boolean({
      char: 'O',
      description: 'Write to stdout instead of a file.'
    }),
    template: Flags.string({
      char: 't',
      default: 'default',
      description: 'HTML template for the generated PDF file.'
    }),
    title: Flags.string({
      char: 'T',
      description: 'Overwrite document title.'
    }),
    browser: Flags.string({
      char: 'b',
      description: 'Browser path that is going to be used for the PDF generation.',
      default: '/usr/bin/brave'
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
      description: 'File to be processed.'
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
  private browser: Browser

  public async shouldRunBefore(): Promise<void> {
    this.cs = this.app.get(ConfigService)
    this.fs = this.app.get(FileSystemService)

    await this.app.get(ParserService).register(JsonParser, YamlParser)

    this.nunjucks.addFilter('markdown_to_html', (markdown: string) => {
      return new showdown.Converter().makeHtml(markdown)
    })
    this.tasks.options = { silentRendererCondition: true }

    if (!this.args.file && !this.flags.stdin) {
      throw new Error('Either --stdin or file argument must be provided.')
    }
  }

  public async run(): Promise<void> {
    this.tasks.add([
      // {
      //   enabled: this.flags.stdin,
      //   task: async (ctx): Promise<void> => {
      //     this.logger.debug('Reading file through stdin...')
      //
      //     if (process.stdin.isTTY) {
      //       this.logger.error('stdin stream is not TTY!')
      //
      //       return
      //     }
      //     // BUG: readline was acting weird
      //     ctx.content = await stdin()
      //     this.logger.debug('File read through stdin: %s%s', EOL, ctx.content)
      //   }
      // },

      {
        task: async(ctx): Promise<void> => {
          if (this.args.file) {
            ctx.file = isAbsolute(this.args.file) ? this.args.file : join(process.cwd(), this.args.file)

            if (!this.fs.exists(ctx.file)) {
              throw new Error(`File does not exists: ${ctx.file}`)
            }

            this.logger.info('Loading file: %s', ctx.file)

            ctx.content = await this.fs.read(ctx.file)
          } else {
            ctx.content = this.flags.stdin
          }

          switch (this.flags['input-filetype'] ? this.flags['input-filetype'] : extname(ctx.file).replace(/^\./, '')) {
            case InputFileType.MARKDOWN: {
              const data = graymatter(ctx.content)

              ctx.content = data.content

              ctx.metadata = data.data

              break
            }

            case InputFileType.YAML:

            // eslint-disable-next-line no-fallthrough
            case InputFileType.YAML_SHORT: {
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

          ctx.templates = new RegExp(/\.\.?\//).test(template) ? join(process.cwd(), template) : join(this.config.root, TEMPLATE_DIRECTORY, template)

          this.logger.info('Loading template: %s from %s', template, ctx.templates)

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
            [TemplateFiles.HEADER]: join(ctx.templates, TemplateFiles.HEADER),
            [TemplateFiles.FOOTER]: join(ctx.templates, TemplateFiles.FOOTER),
            [TemplateFiles.TEMPLATE]: join(ctx.templates, TemplateFiles.TEMPLATE)
          }

          ctx.options = await this.cs.extend<MdToPdfConfig>([
            paths[TemplateFiles.SETTINGS],
            {
              dest: this.args?.output ?? ctx.metadata?.dest ?? `${basename(this.args.file, extname(this.args.file))}.${this.flags['output-filetype']}`,
              document_title: ctx.metadata?.document_title ?? this.flags.title ?? this.args.file,
              // https://github.com/simonhaenisch/md-to-pdf/issues/247
              launch_options: {
                executablePath: this.flags.browser
                // headless: true
              }
            }
          ])

          this.flags.stdout ??= ctx.metadata.stdout

          if (this.flags.stdout) {
            ctx.options.dest = 'stdout'
          }

          if (this.flags['output-filetype'] === OutputFileType.HTML || ctx.metadata['output-filetype'] === OutputFileType.HTML) {
            ctx.options.as_html = true
          }

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
            this.logger.debug('Tailwind CSS exists for template: %s -> %s', paths[TemplateFiles.TAILWIND_CSS])

            ctx.options.css = await postcss([
              tailwind({
                // content: [{ raw: ctx.template, extension: 'html' }],
                base: ctx.templates
              })
            ])
              .process(await this.fs.read(paths[TemplateFiles.TAILWIND_CSS]), { from: paths[TemplateFiles.TAILWIND_CSS] })
              .then((result) => result.css)
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
        const ctx = await this.runTasks()

        this.logger.info('Waiting for the next change.')

        return this.runMd2Pdf(ctx).catch((err) => {
          this.logger.error(err)
        })
      })

      return this.runMd2Pdf(ctx)
    }

    await this.runMd2Pdf(ctx)

    if (this.browser) {
      await this.browser.close()
    }
  }

  private async runMd2Pdf(ctx: MdPrinterCtx): Promise<void> {
    const options = merge<MdToPdfConfig>(MergeStrategy.EXTEND, { basedir: process.cwd() }, MdToPdfDefaultConfig, ctx.options, {
      devtools: this.flags.dev
    })

    // if (this.browser) {
    //   await Promise.all( pages.map(async(page) => {
    //       return page.close().catch((err) => {
    //         this.logger.error('Can not close page: %o', err)
    //       })
    //     })
    //   )
    // }
    this.browser ??= await puppeteer.launch({ devtools: options.devtools, ...options.launch_options })

    const server = await serveDirectory(ctx.options as MdToPdfConfig)

    options.port = (server.address() as AddressInfo).port

    let output: PdfOutput | HtmlOutput

    if (ctx.template) {
      this.logger.info('Rendering as template.')
      output = await convertMdToPdf({ content: this.nunjucks.renderString(ctx.template, { ...(ctx.metadata ?? {}), content: ctx.content }) }, options as MdToPdfConfig, {
        browser: this.browser
      })
    } else {
      this.logger.info('Rendering as plain file.')
      output = await convertMdToPdf({ content: ctx.content }, options as MdToPdfConfig, { browser: this.browser })
    }

    await new Promise((resolve, reject) =>
      server.close((err) => {
        if (err) {
          return reject(err)
        }

        resolve(null)
      })
    )

    if (output) {
      if (this.flags.stdout) {
        process.stdout.write(output.content)

        return
      }

      if (!output.filename) {
        throw new Error('Output should either be defined with the variable or front-matter.')
      }

      this.logger.info('Output file will be: %s', output.filename)

      await this.fs.mkdir(dirname(output.filename))

      this.logger.info('Writing file to output: %s', output.filename)

      await this.fs.write(output.filename, output.content)
    }
  }
}
