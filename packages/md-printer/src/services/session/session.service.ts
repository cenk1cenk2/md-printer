import type { OnModuleDestroy } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { FSWatcher } from 'chokidar'
import { watch } from 'chokidar'
import { isEqual } from 'es-toolkit'
import { EventEmitter } from 'events'
import { dirname, join, resolve } from 'path'
import { debounce } from 'perfect-debounce'

import { PrinterService } from '../printer.service.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { TemplateFiles } from '@constants'
import type { MdPrinterCtx, MdPrinterFlags, SessionBundle, SessionEvents } from '@interfaces'

/**
 * Builds never overlap, so a slow build is not raced by the next one; a change during a build triggers exactly one more.
 */
@Injectable()
export class SessionService extends EventEmitter<SessionEvents> implements OnModuleDestroy {
  private watcher?: FSWatcher
  private bundle?: SessionBundle
  private stopped = false
  private modules = new Set<string>()
  private watched = new Set<string>()
  private version = 0
  private building?: Promise<void>
  private flags: MdPrinterFlags
  private ignored = new Set<string>()
  // perfect-debounce never overlaps two runs and queues exactly one more for the calls made during a run
  private readonly build = debounce((): Promise<void> => (this.stopped ? Promise.resolve() : (this.building = this.run())), 50)

  constructor(
    private readonly logger: LoggerService,
    private readonly printer: PrinterService
  ) {
    super()

    this.logger.setup(this.constructor.name)
  }

  public async start(flags: MdPrinterFlags): Promise<void> {
    this.flags = flags
    this.watcher = watch([], { ignoreInitial: true, atomic: true })
      .on('change', (path) => this.changed(path))
      .on('add', (path) => this.changed(path))
      .on('unlink', (path) => this.changed(path))

    await this.build()
  }

  public async onModuleDestroy(): Promise<void> {
    await this.stop()
  }

  public ignore(path: string): void {
    this.ignored.add(resolve(path))
  }

  public async stop(): Promise<void> {
    this.stopped = true
    this.build.cancel()

    await this.building
    await this.watcher?.close()

    this.watcher = undefined
  }

  private changed(path: string): void {
    const file = resolve(path)

    if (this.ignored.has(file)) {
      return
    }

    this.logger.debug('Changed: %s', file)

    // a component added to or removed from one of the template's components folders changes the registry the bundle holds
    if (this.modules.has(file) || this.bundle?.files.components.includes(dirname(file))) {
      this.bundle = undefined
    }

    void this.build()
  }

  private async run(): Promise<void> {
    const started = performance.now()

    this.emit('building')

    try {
      const input = await this.printer.input(this.flags)
      const options = await this.printer.options(this.flags, input)
      const { files } = options

      // the template itself is watched before its first bundle, so an edit made while it bundles is not lost
      this.modules = new Set([...this.modules, files.template])
      this.watch([input.file, files.template, ...files.candidates, join(options.template, TemplateFiles.SETTINGS), options.sign.certificate && resolve(options.sign.certificate)])

      // an extension module that appeared or a changed files section resolves to other paths
      if (!isEqual(this.bundle?.files, files)) {
        this.bundle = { files, bundle: this.printer.bundle(options) }
      }

      const cached = this.bundle
      const bundle = await cached.bundle.catch((err) => {
        if (this.bundle === cached) {
          this.bundle = undefined
        }

        throw err
      })

      // a module changed while bundling, the build that change queued bundles again
      if (this.bundle !== cached) {
        return
      }

      this.modules = new Set([files.template, ...bundle.modules])
      this.watch(bundle.modules)

      const ctx: MdPrinterCtx = { input, options }

      await this.printer.prepare(ctx)

      const document = await this.printer.document(ctx, bundle)

      this.watch(document.dependencies)

      const { content, assets } = await this.printer.output(ctx, document)

      this.watch(assets)

      this.emit('ready', {
        version: ++this.version,
        ms: Math.round(performance.now() - started),
        ctx,
        document,
        output: content
      })
    } catch(err) {
      this.emit('failed', err instanceof Error ? err : new Error(String(err)))
    }
  }

  private watch(paths: (string | undefined)[]): void {
    const fresh = paths.filter((path) => path && !this.watched.has(path))

    for (const path of fresh) {
      this.watched.add(path)
    }

    if (fresh.length) {
      this.watcher.add(fresh)
    }
  }
}
