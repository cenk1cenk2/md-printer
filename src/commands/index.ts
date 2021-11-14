import { BaseCommand, deepMergeWithArrayOverwrite } from '@cenk1cenk2/boilerplate-oclif'
import { flags } from '@oclif/command'
import { INPUT_FILE_ACCEPTED_TYPES, OUTPUT_FILE_ACCEPTED_TYPES, TemplateFiles, TEMPLATE_DIRECTORY } from '@src/constants'
import { MdPrinterCtx } from '@src/interfaces/commands'
import fs from 'fs-extra'
import mdToPdf from 'md-to-pdf'
import { PdfConfig } from 'md-to-pdf/dist/lib/config'
import { join, extname } from 'path'
import { basename } from 'path/posix'

export default class MDPrinter extends BaseCommand {
  static description = 'Generates a PDF from the given markdown file with the selected HTML template.'

  static flags = {
    help: flags.help({ char: 'h' }),
    template: flags.string({
      char: 't',
      default: 'default',
      description: 'HTML template for the generated PDF file.'
    }),
    title: flags.string({
      char: 'T',
      description: 'Overwrite document title.'
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

  async run (): Promise<void> {
    const { args, flags } = this.parse(MDPrinter)

    this.tasks.options = { rendererSilent: true }

    this.tasks.add<MdPrinterCtx>([
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
        }
      },

      {
        task: async (ctx): Promise<void> => {
          this.logger.debug('Loading template: %s', flags.template)

          const templates = join(this.config.root, TEMPLATE_DIRECTORY, flags.template)

          await Promise.all(
            Object.values(TemplateFiles).map(async (file) => {
              const current = join(templates, file)
              if (!fs.existsSync(current)) {
                throw new Error(`Template file does not exists: ${current}`)
              }
            })
          )

          ctx.options = deepMergeWithArrayOverwrite<Partial<PdfConfig>>(await fs.readJSON(join(templates, TemplateFiles.SETTINGS)), {
            css: await fs.readFile(join(templates, TemplateFiles.CSS), 'utf-8'),
            pdf_options: {
              headerTemplate: await fs.readFile(join(templates, TemplateFiles.HEADER), 'utf-8'),
              footerTemplate: await fs.readFile(join(templates, TemplateFiles.FOOTER), 'utf-8')
            },
            document_title: flags.title ?? args.file
          })
        }
      },

      {
        task: async (ctx): Promise<void> => {
          const pdf = await mdToPdf({ content: ctx.content }, ctx.options)

          let output: string
          if (args.output) {
            output = args.output
          } else if (pdf.filename) {
            output = pdf.filename
          } else {
            output = `${basename(args.file, extname(args.file))}.pdf`
          }

          if (!output) {
            throw new Error('Output should either be defined with the variable or front-matter.')
          } else if (!OUTPUT_FILE_ACCEPTED_TYPES.includes(extname(output))) {
            throw new Error(`Output file should be ending with the extension: ${OUTPUT_FILE_ACCEPTED_TYPES.join(', ')} -> current: ${extname(output)}`)
          }

          this.logger.debug('Output file will be: %s', output)

          if (pdf) {
            this.logger.debug('Writing file to output: %s', output)

            await fs.writeFile(output, pdf.content)
          }
        }
      }
    ])
  }
}
