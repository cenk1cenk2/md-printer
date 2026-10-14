import { MdPrinterHandler } from '../modules/md-printer/md-printer.handler.js'
import { MdPrinterModule } from '../modules/md-printer/md-printer.module.js'
import { Args, Command, Flags, UseHandler } from '@cenk1cenk2/oclif-common'
import { InputFileType, OutputFileType } from '@constants'

@UseHandler({ module: MdPrinterModule, handler: MdPrinterHandler })
export default class MDPrinter extends Command {
  static description = 'Renders a markdown or yaml file through a Svelte template into a PDF or HTML document.'

  static flags = {
    stdin: Flags.boolean({
      char: 'I',
      description: 'Read the input from stdin.'
    }),
    ['input-filetype']: Flags.string({
      char: 'f',
      options: Object.values(InputFileType),
      description: 'Input file type. Detected from the file extension, markdown for stdin and unknown extensions.'
    }),
    ['output-filetype']: Flags.string({
      char: 'F',
      options: Object.values(OutputFileType),
      description: 'Output file type, defaults to pdf. Overwrites the one defined in front-matter.'
    }),
    stdout: Flags.boolean({
      char: 'O',
      description: 'Write the output to stdout instead of a file.'
    }),
    template: Flags.string({
      char: 't',
      description: 'Built-in template name or path to a template directory, defaults to "default". Overwrites the one defined in front-matter.'
    }),
    title: Flags.string({
      char: 'T',
      description: 'Document title. Overwrites the one defined in front-matter or the template.'
    }),
    language: Flags.string({
      char: 'l',
      description: 'Language for template translations. Overwrites the one defined in front-matter and template settings.'
    }),
    browser: Flags.string({
      char: 'b',
      description: 'Browser executable used for printing. Discovered automatically when omitted (Brave, Chrome, Chromium, Edge).'
    }),
    continuous: Flags.boolean({
      description: 'Render the PDF as a single continuous page without page breaks.'
    }),
    preview: Flags.boolean({
      char: 'p',
      description: 'Rebuild whenever the input, the template or its assets change, show the HTML and the PDF in a live preview and rewrite the output file when there is one.'
    }),
    host: Flags.string({
      description: 'Loopback host for the preview server, it serves the files next to the input and is never exposed to the network.',
      options: ['127.0.0.1', 'localhost', '::1'],
      default: '127.0.0.1'
    }),
    port: Flags.integer({
      description: 'Port for the preview server, random when 0.',
      default: 0
    }),
    open: Flags.boolean({
      description: 'Open the preview window, --no-open keeps rebuilding and writing without one.',
      default: true,
      allowNo: true
    }),
    sign: Flags.boolean({
      description: 'Sign the PDF with a qualified electronic signature through ID Austria (A-Trust).'
    }),
    ['sign-provider']: Flags.string({
      description: 'Signature provider, defaults to a-trust. Overwrites the one defined in front-matter and template settings.'
    }),
    ['sign-certificate']: Flags.string({
      description: 'Signer certificate (DER or PEM) used for the visible signature block and to verify the returned signature.'
    })
  }

  static args = {
    file: Args.string({
      description: 'Markdown or yaml file to render.',
      ignoreStdin: true
    }),
    output: Args.string({
      description: 'Output file. Overwrites the one defined in front-matter.',
      required: false,
      ignoreStdin: true
    })
  }
}
