import { Injectable } from '@nestjs/common'
import type { FSWatcher } from 'chokidar'
import { watch } from 'chokidar'
import { EventEmitter } from 'events'
import { join, resolve } from 'path'

import { PrinterService } from '../printer.service.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { I18N_DIRECTORY, TemplateFiles } from '@constants'
import type { MdPrinterCtx, MdPrinterFlags, SessionEvents, TemplateBundle } from '@interfaces'

/**
 * Rebuilds the document whenever one of its inputs changes: the input file, template settings, translations, every module of the template bundle,
 * the stylesheets Tailwind read and the local assets the page loaded. Builds never overlap; a change during a build triggers exactly one more.
 */
@Injectable()
export class SessionService extends EventEmitter<SessionEvents> {
  private static readonly DEBOUNCE = 50

  private watcher?: FSWatcher
  private bundle?: TemplateBundle
  private modules = new Set<string>()
  private watched = new Set<string>()
  private version = 0
  private timer?: NodeJS.Timeout
  private building?: Promise<void>
  private dirty = false
  private flags: MdPrinterFlags
  private ignored = new Set<string>()

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

  public ignore(path: string): void {
    this.ignored.add(resolve(path))
  }

  public async stop(): Promise<void> {
    clearTimeout(this.timer)

    await this.building
    await this.watcher?.close()
  }

  private changed(path: string): void {
    const file = resolve(path)

    if (this.ignored.has(file)) {
      return
    }

    this.logger.debug('Changed: %s', file)

    if (this.modules.has(file)) {
      this.bundle = undefined
    }

    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.build(), SessionService.DEBOUNCE)
  }

  private build(): Promise<void> {
    if (this.building) {
      this.dirty = true

      return this.building
    }

    this.building = this.run().finally(() => {
      this.building = undefined

      if (this.dirty) {
        this.dirty = false

        void this.build()
      }
    })

    return this.building
  }

  private async run(): Promise<void> {
    const started = performance.now()

    this.emit('building')

    try {
      const input = await this.printer.input(this.flags)
      const options = await this.printer.options(this.flags, input)

      this.watch([
        input.file,
        join(options.template, TemplateFiles.SETTINGS),
        join(options.template, I18N_DIRECTORY),
        options.sign.certificate && resolve(options.sign.certificate)
      ])

      if (!this.bundle) {
        this.bundle = await this.printer.bundle(options)
        this.modules = new Set(this.bundle.modules)
        this.watch(this.bundle.modules)
      }

      const ctx: MdPrinterCtx = { input, options }

      await this.printer.prepare(ctx)

      const document = await this.printer.document(ctx, this.bundle)

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
