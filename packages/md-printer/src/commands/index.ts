import { MdPrinterHandler } from '../modules/md-printer/md-printer.handler.js'
import { MdPrinterModule } from '../modules/md-printer/md-printer.module.js'
import { MdPrinterSchema } from '../modules/md-printer/md-printer.schema.js'
import { Args, Command, Flags, UseHandler } from '@cenk1cenk2/oclif-common'

@UseHandler({
  module: MdPrinterModule,
  handler: MdPrinterHandler,
  schema: MdPrinterSchema
})
export default class MDPrinter extends Command {
  static description = 'Renders a markdown or yaml file through a Svelte template into a PDF or HTML document.'

  static flags = {
    stdin: Flags.boolean({ char: 'I' }),
    ['input-filetype']: Flags.string({ char: 'f' }),
    ['output-filetype']: Flags.string({ char: 'F' }),
    stdout: Flags.boolean({ char: 'O' }),
    template: Flags.string({ char: 't' }),
    title: Flags.string({ char: 'T' }),
    language: Flags.string({ char: 'l' }),
    browser: Flags.string({ char: 'b' }),
    continuous: Flags.boolean(),
    preview: Flags.boolean({ char: 'p' }),
    host: Flags.string(),
    port: Flags.integer(),
    open: Flags.boolean({ allowNo: true }),
    sign: Flags.boolean(),
    ['sign-provider']: Flags.string(),
    ['sign-certificate']: Flags.string()
  }

  static args = {
    file: Args.string({ ignoreStdin: true }),
    output: Args.string({ ignoreStdin: true })
  }
}
