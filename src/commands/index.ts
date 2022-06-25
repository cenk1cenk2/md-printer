import { flags } from '@oclif/command'
import { watch } from 'chokidar'
import fs from 'fs-extra'
import { read as graymatter } from 'gray-matter'
import mdToPdf from 'md-to-pdf'
import type { PdfConfig } from 'md-to-pdf/dist/lib/config'
import type { PdfOutput } from 'md-to-pdf/dist/lib/generate-output'
import Nunjucks from 'nunjucks'
import { basename, dirname, extname, join } from 'path'

import { BaseCommand, deepMergeWithArrayOverwrite } from '@cenk1cenk2/boilerplate-oclif'
import { INPUT_FILE_ACCEPTED_TYPES, OUTPUT_FILE_ACCEPTED_TYPES, RequiredTemplateFiles, TemplateFiles, TEMPLATE_DIRECTORY } from '@src/constants'
import type { MdPrinterCtx } from '@src/interfaces/commands'

export default class MDPrinter extends BaseCommand {
  static description = 'Generates a PDF from the given markdown file with the selected HTML template.'

  static flags = {
    template: flags.string({
      char: 't',
      default: 'default',
      description: 'HTML template for the generated PDF file.'
    }),
    title: flags.string({
      char: 'T',
      description: 'Overwrite document title.'
    }),
    watch: flags.boolean({
      char: 'w',
      description: 'Watch the changes on the given file.'
    }),
    dev: flags.boolean({
      char: 'd',
      description: 'Run with Chrome browser instead of publishing the file.'
    })
  }

  static args = [
    {
      name: 'file',
      description: 'Markdown file to be processed.',
      required: true
    },
    {
      name: 'output',
      description: 'Output file that will be generated. Overwrites the one define in front-matter.',
      required: false
    }
  ]

  private nunjucks = Nunjucks.configure({
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: false
  })

  public async run (): Promise<void> {
    const { args, flags } = this.parse(MDPrinter)

    this.tasks.options = { rendererSilent: true }

    const tasks = this.tasks.newListr<MdPrinterCtx>([
      {
        task: async (ctx): Promise<void> => {
          const file = join(process.cwd(), args.file)

          if (!INPUT_FILE_ACCEPTED_TYPES.includes(extname(file))) {
            throw new Error(`Input file should be ending with the extension: ${INPUT_FILE_ACCEPTED_TYPES.join(', ')} -> current: ${extname(file)}`)
          }

          if (!fs.existsSync(file)) {
            throw new Error(`File does not exists: ${file}`)
          }

          this.logger.debug('Loading file: %s', file)

          ctx.file = file

          ctx.content = await fs.readFile(file, 'utf-8')

          ctx.graymatter = graymatter(ctx.file)
        }
      },

      {
        task: async (ctx): Promise<void> => {
          const template = ctx.graymatter?.data?.template ?? flags.template

          this.logger.debug('Loading template: %s', template)

          ctx.templates = new RegExp(/\.\.?\//).test(template) ? join(process.cwd(), template) : join(this.config.root, TEMPLATE_DIRECTORY, template)

          await Promise.all(
            RequiredTemplateFiles.map(async (file) => {
              const current = join(ctx.templates, file)

              if (!fs.existsSync(current)) {
                throw new Error(`Template does not exists: ${current}`)
              }
            })
          )

          const paths: Record<TemplateFiles, string> = {
            [TemplateFiles.SETTINGS]: join(ctx.templates, TemplateFiles.SETTINGS),
            [TemplateFiles.CSS]: join(ctx.templates, TemplateFiles.CSS),
            [TemplateFiles.HEADER]: join(ctx.templates, TemplateFiles.HEADER),
            [TemplateFiles.FOOTER]: join(ctx.templates, TemplateFiles.FOOTER),
            [TemplateFiles.TEMPLATE]: join(ctx.templates, TemplateFiles.TEMPLATE)
          }

          ctx.options = deepMergeWithArrayOverwrite<Partial<PdfConfig>>(await fs.readJSON(paths[TemplateFiles.SETTINGS]), {
            pdf_options: {},
            dest: args?.output ?? ctx.graymatter.data?.dest ?? `${basename(args.file, extname(args.file))}.pdf`,
            document_title: ctx.graymatter.data?.document_title ?? flags.title ?? args.file
          })

          if (fs.existsSync(paths[TemplateFiles.CSS])) {
            this.logger.debug('CSS exists for template.')
            ctx.options.css = await fs.readFile(paths[TemplateFiles.CSS], 'utf-8')
          }

          if (fs.existsSync(paths[TemplateFiles.HEADER])) {
            this.logger.debug('Header exists for template.')

            ctx.options.pdf_options.headerTemplate = await fs.readFile(paths[TemplateFiles.HEADER], 'utf-8')
          }

          if (fs.existsSync(paths[TemplateFiles.FOOTER])) {
            this.logger.debug('Footer exists for template.')

            ctx.options.pdf_options.footerTemplate = await fs.readFile(paths[TemplateFiles.FOOTER], 'utf-8')
          }

          if (fs.existsSync(paths[TemplateFiles.TEMPLATE])) {
            this.logger.debug('Design template exists for template.')

            ctx.template = await fs.readFile(paths[TemplateFiles.TEMPLATE], 'utf-8')

            ctx.content = ctx.graymatter.content

            this.logger.debug('Frontmatter: %o', ctx.graymatter.data)
          }
        }
      },

      {
        task: async (ctx): Promise<void> => {
          if (flags.dev) {
            ctx.options.devtools = true
          }

          return this.runMd2Pdf(ctx)
        }
      }
    ])

    const ctx = await tasks.run()

    if (flags.watch) {
      this.logger.info('Running in watch mode.')

      watch([ args.file, join(ctx.templates, '**/*') ]).on('change', async () => {
        await tasks.run()

        this.logger.info('Waiting for the next change.')
      })
    }
  }

  private async runMd2Pdf (ctx: MdPrinterCtx): Promise<void> {
    let pdf: PdfOutput

    if (ctx.template) {
      this.logger.debug('Rendering as template.')
      pdf = await mdToPdf({ content: this.nunjucks.renderString(ctx.template, { ...ctx.graymatter?.data ?? {}, content: ctx.content }) }, ctx.options)
    } else {
      this.logger.debug('Rendering as plain file.')
      pdf = await mdToPdf({ content: ctx.content }, ctx.options)
    }

    const output = pdf.filename

    await fs.mkdirp(dirname(output))

    if (!output) {
      throw new Error('Output should either be defined with the variable or front-matter.')
    } else if (!OUTPUT_FILE_ACCEPTED_TYPES.includes(extname(output))) {
      throw new Error(`Output file should be ending with the extension: ${OUTPUT_FILE_ACCEPTED_TYPES.join(', ')} -> current: ${extname(output)}`)
    }

    this.logger.debug('Output file will be: %s', output)

    if (pdf) {
      this.logger.info('Writing file to output: %s', output)

      await fs.writeFile(output, pdf.content)
    }
  }
}
