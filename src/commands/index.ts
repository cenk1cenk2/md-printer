import { mkdir, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { text } from 'stream/consumers'

import type { DynamicModule, RegisterHook, ShouldRunBeforeHook } from '@cenk1cenk2/oclif-common'
import { Args, Command, Flags, JsonParser, ParserService, YamlParser } from '@cenk1cenk2/oclif-common'
import { InputFileType, OutputFileType } from '@constants'
import type { MdPrinterCtx, MdPrinterFlags } from '@interfaces'
import { BrowserService, PreviewService, PrinterModule, PrinterService, SessionService } from '@services'

export default class MDPrinter extends Command<typeof MDPrinter> implements RegisterHook, ShouldRunBeforeHook {
  static description = 'Renders a markdown or yaml file through a Svelte template into a PDF or HTML document.'

  static flags = {
    stdin: Flags.boolean({
      char: 'I',
      description: 'Read the input from stdin.'
    }),
    ['input-filetype']: Flags.string({
      char: 'f',
      options: Object.values(InputFileType),
      description: 'Input file type. Detected from the file extension, markdown for stdin.'
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
    watch: Flags.boolean({
      char: 'w',
      description: 'Rebuild and write the output whenever the input, the template or its assets change.'
    }),
    preview: Flags.boolean({
      char: 'p',
      aliases: ['dev'],
      charAliases: ['d'],
      deprecateAliases: true,
      description: 'Open a live preview of the HTML and the PDF in the browser. Combine with --watch to also write the output.'
    }),
    host: Flags.string({
      description: 'Host for the preview server.',
      default: '127.0.0.1'
    }),
    port: Flags.integer({
      description: 'Port for the preview server, random when 0.',
      default: 0
    }),
    open: Flags.boolean({
      description: 'Open the preview window.',
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

  private printer: PrinterService
  private browser: BrowserService

  public register(cli: DynamicModule): DynamicModule {
    return {
      ...cli,
      imports: [...(cli.imports ?? []), PrinterModule]
    }
  }

  public async shouldRunBefore(): Promise<void> {
    await this.app.get(ParserService).register(JsonParser, YamlParser)

    this.printer = this.app.get(PrinterService)
    this.browser = this.app.get(BrowserService)
    this.browser.use(this.flags.browser)
  }

  public async run(): Promise<void> {
    const flags: MdPrinterFlags = {
      file: this.flags.stdin ? undefined : this.args.file,
      // with stdin there is no input file, so the only argument is the output
      output: this.flags.stdin ? (this.args.output ?? this.args.file) : this.args.output,
      stdin: this.flags.stdin ? await text(process.stdin) : undefined,
      inputFiletype: this.flags['input-filetype'],
      outputFiletype: this.flags['output-filetype'],
      stdout: this.flags.stdout,
      template: this.flags.template,
      title: this.flags.title,
      language: this.flags.language,
      continuous: this.flags.continuous,
      sign: this.flags.sign,
      signProvider: this.flags['sign-provider'],
      signCertificate: this.flags['sign-certificate']
    }

    if (this.flags.watch || this.flags.preview) {
      await this.session(flags)
    } else {
      await this.print(flags)
    }
  }

  private async print(flags: MdPrinterFlags): Promise<void> {
    const input = await this.printer.input(flags)
    const ctx: MdPrinterCtx = { input, options: await this.printer.options(flags, input) }

    this.logger.debug('Options: %o', ctx.options)

    await this.printer.prepare(ctx)

    const document = await this.printer.document(ctx, await this.printer.bundle(ctx.options))
    let { content } = await this.printer.output(ctx, document)

    if (ctx.signature) {
      content = await this.printer.sign(ctx, content)

      this.logger.info('Document is signed.')
    }

    await this.write(ctx, content)
  }

  private async session(flags: MdPrinterFlags): Promise<void> {
    if (flags.stdout) {
      throw new Error('Writing to stdout is not supported with --watch or --preview.')
    }

    const session = this.app.get(SessionService)
    const preview = this.flags.preview ? this.app.get(PreviewService) : undefined

    session.on('building', () => preview?.building())
    session.on('failed', (err) => {
      this.logger.error(err.message)

      preview?.failed(err)
    })
    session.on('ready', async(build) => {
      preview?.ready(build)

      if (!this.flags.watch) {
        this.logger.info('Rebuilt in %dms.', build.ms)

        return
      }

      if (!build.ctx.options.dest) {
        this.logger.warn('No output file to write, pass an output argument or set dest in front-matter.')

        return
      }

      session.ignore(build.ctx.options.dest)

      await this.write(build.ctx, build.output).catch((err) => this.logger.error(err.message))
    })

    if (flags.sign) {
      this.logger.warn('Signing is skipped while watching or previewing, run without --watch and --preview to sign the document.')
    }

    const stopped = new Promise<void>((done) => {
      // replace the default handler, which exits before the browser, the server and the watcher are closed
      process.removeAllListeners('SIGINT')
      process.removeAllListeners('SIGTERM')
      process.once('SIGINT', () => done())
      process.once('SIGTERM', () => done())
    })

    await session.start(flags)

    if (preview) {
      const url = await preview.listen({ host: this.flags.host, port: this.flags.port })

      this.logger.info('Preview is running at: %s', url)

      await Promise.race([stopped, this.flags.open ? preview.open(this.browser.executable(), url) : new Promise<never>(() => undefined)])

      await preview.close()
    } else {
      this.logger.info('Watching for changes, press Ctrl+C to stop.')

      await stopped
    }

    await session.stop()
  }

  private async write(ctx: MdPrinterCtx, content: Buffer): Promise<void> {
    const { dest } = ctx.options

    if (!dest) {
      process.stdout.write(content)

      return
    }

    await mkdir(dirname(dest), { recursive: true })

    // rename into place so PDF viewers reloading on change never read a half-written file
    const temporary = `${dest}.${process.pid}.tmp`

    await writeFile(temporary, content)
    await rename(temporary, dest)

    this.logger.info('Written: %s', dest)
  }
}
