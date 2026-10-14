import { Injectable } from '@nestjs/common'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { text } from 'stream/consumers'
import writeFileAtomic from 'write-file-atomic'

import type MDPrinter from '../../commands/index.js'
import type { CommandContext, CommandHandler } from '@cenk1cenk2/oclif-common'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import type { MdPrinterCtx, MdPrinterFlags } from '@interfaces'
import { BrowserService, PreviewService, PrinterService, SessionService } from '@services'

@Injectable()
export class MdPrinterHandler implements CommandHandler<typeof MDPrinter> {
  constructor(
    private readonly logger: LoggerService,
    private readonly printer: PrinterService,
    private readonly browser: BrowserService,
    private readonly session: SessionService,
    private readonly preview: PreviewService
  ) {}

  public async run(context: CommandContext<typeof MDPrinter>): Promise<void> {
    const { flags, args } = context
    const options: MdPrinterFlags = {
      file: flags.stdin ? undefined : args.file,
      // with stdin there is no input file, so the only argument is the output
      output: flags.stdin ? (args.output ?? args.file) : args.output,
      stdin: flags.stdin ? await text(process.stdin) : undefined,
      inputFiletype: flags['input-filetype'],
      outputFiletype: flags['output-filetype'],
      stdout: flags.stdout,
      template: flags.template,
      title: flags.title,
      language: flags.language,
      continuous: flags.continuous,
      sign: flags.sign,
      signProvider: flags['sign-provider'],
      signCertificate: flags['sign-certificate']
    }

    if (flags.preview) {
      await this.watch(context, options)
    } else {
      await this.print(options)
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

    await this.write(ctx, content, flags.stdout)
  }

  private async watch({ flags, signal }: CommandContext<typeof MDPrinter>, options: MdPrinterFlags): Promise<void> {
    if (options.stdout) {
      throw new Error('Writing to stdout is not supported with --preview.')
    }

    let writes = Promise.resolve()

    this.session.on('building', () => this.preview.building())
    this.session.on('failed', (err) => {
      this.logger.error(err.message)

      this.preview.failed(err)
    })
    this.session.on('ready', async(build) => {
      this.preview.ready(build)

      if (!build.ctx.options.dest) {
        this.logger.info('Rebuilt in %dms.', build.ms)

        return
      }

      this.session.ignore(build.ctx.options.dest)

      // queued, so a slow write never lands after the one of a newer build
      writes = writes.then(() => this.write(build.ctx, build.output, options.stdout)).catch((err) => this.logger.error(err.message))

      await writes
    })

    if (options.sign) {
      this.logger.warn('Signing is skipped while previewing, run without --preview to sign the document.')
    }

    const stopped = new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))

    await this.session.start(options)

    const url = await this.preview.listen({ host: flags.host, port: flags.port })

    this.logger.info('Preview is running at %s, press Ctrl+C to stop.', url)

    await Promise.race([stopped, flags.open ? this.preview.open(this.browser.executable(), url) : new Promise<never>(() => undefined)])

    await this.preview.close()

    await this.session.stop()

    await writes
  }

  private async write(ctx: MdPrinterCtx, content: Buffer, stdout: boolean): Promise<void> {
    const { dest } = ctx.options

    if (!dest) {
      if (!stdout) {
        throw new Error('No output file to write, pass an output argument, set dest in front-matter or use --stdout.')
      }

      process.stdout.write(content)

      return
    }

    await mkdir(dirname(dest), { recursive: true })

    // PDF viewers reloading on change never read a half-written file
    await writeFileAtomic(dest, content)

    this.logger.info('Written: %s', dest)
  }
}
