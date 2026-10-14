import type { OnModuleDestroy } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { once } from 'events'
import { mkdtemp, rm } from 'fs/promises'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import serveStatic from 'serve-static'
import { fileURLToPath } from 'url'

import { isLoopbackRequest } from '../loopback.js'
import { resolveConfined } from '../template/assets.js'
import { TemplateService } from '../template/template.service.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { OutputFileType } from '@constants'
import type { CompileError, PreviewError, PreviewOptions, PreviewSummary, SessionBuild } from '@interfaces'

@Injectable()
export class PreviewService implements OnModuleDestroy {
  private server?: Server
  private clients = new Set<ServerResponse>()
  private build?: SessionBuild
  private error?: PreviewError
  private profile?: string
  private window?: ChildProcess

  constructor(
    private readonly logger: LoggerService,
    private readonly template: TemplateService
  ) {
    this.logger.setup(this.constructor.name)
  }

  public async listen(options: PreviewOptions): Promise<string> {
    const shell = await this.template.page(fileURLToPath(new URL('./Preview.svelte', import.meta.url)))

    this.server = createServer((req, res) => {
      this.handle(req, res, shell).catch((err) => {
        this.logger.debug('Preview request failed: %s', err)

        res.writeHead(500)
        res.end()
      })
    })

    this.server.listen(options.port, options.host)

    await once(this.server, 'listening')

    const { port } = this.server.address() as AddressInfo

    return `http://${options.host.includes(':') ? `[${options.host}]` : options.host}:${port}/`
  }

  public building(): void {
    this.send('building', {})
  }

  public ready(build: SessionBuild): void {
    this.build = build
    this.error = undefined

    this.send('ready', this.summary(build))
  }

  public failed(err: CompileError): void {
    this.error = {
      message: err.message,
      frame: err.frame,
      file: err.filename
    }

    this.send('failed', this.error)
  }

  public async open(executable: string, url: string): Promise<void> {
    this.profile = await mkdtemp(join(tmpdir(), 'md-printer-preview-'))
    this.window = spawn(executable, [`--app=${url}`, `--user-data-dir=${this.profile}`, '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore' })

    await new Promise<void>((done) => {
      this.window.on('exit', () => done())
      this.window.on('error', (err) => {
        this.logger.warn('Can not open the preview window, open it manually: %s (%s)', url, err.message)
      })
    })
  }

  public async onModuleDestroy(): Promise<void> {
    await this.close()
  }

  public async close(): Promise<void> {
    const { server, window, profile } = this

    this.server = undefined
    this.window = undefined
    this.profile = undefined

    for (const client of this.clients) {
      client.end()
    }

    this.clients.clear()

    // the browser holds its profile open until it exits
    if (window && window.exitCode === null && window.signalCode === null && window.kill()) {
      await once(window, 'exit')
    }

    if (server?.listening) {
      server.close()

      await once(server, 'close')
    }

    if (profile) {
      await rm(profile, { recursive: true, force: true })
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse, shell: string): Promise<void> {
    if (!isLoopbackRequest(req)) {
      res.writeHead(403)

      return void res.end()
    }

    const url = new URL(req.url, 'http://localhost')

    switch (url.pathname) {
      case '/':
        res.writeHead(200, { ['content-type']: 'text/html; charset=utf-8', ['cache-control']: 'no-store' })

        return void res.end(shell)

      case '/__events':
        res.writeHead(200, {
          ['content-type']: 'text/event-stream',
          ['cache-control']: 'no-store',
          connection: 'keep-alive'
        })
        res.write('retry: 1000\n\n')

        this.clients.add(res)
        req.on('close', () => this.clients.delete(res))

        if (this.error) {
          res.write(this.event('failed', this.error))
        } else if (this.build) {
          res.write(this.event('ready', this.summary(this.build)))
        }

        return

      case '/document.html':
        if (!this.build) {
          res.writeHead(404)

          return void res.end()
        }

        res.writeHead(200, { ['content-type']: 'text/html; charset=utf-8', ['cache-control']: 'no-store' })

        return void res.end(this.build.document.html)

      case '/document.pdf':
        if (this.build?.ctx.options.output !== OutputFileType.PDF) {
          res.writeHead(404)

          return void res.end()
        }

        res.writeHead(200, { ['content-type']: 'application/pdf', ['cache-control']: 'no-store' })

        return void res.end(this.build.output)

      default:
        return this.asset(req, res)
    }
  }

  private async asset(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const reject = (status = 404): void => {
      res.writeHead(status)
      res.end()
    }

    if (!this.build) {
      return reject()
    }

    const base = this.build.ctx.input.directory
    const url = URL.parse(req.url, 'file:///')
    const path = url && join(base, fileURLToPath(url))

    // serve-static follows symlinks, so a link pointing outside the directory is refused before it gets the request
    if (!path || !(await resolveConfined(path, base))) {
      return reject()
    }

    serveStatic(base, {
      dotfiles: 'ignore',
      index: false,
      fallthrough: false,
      cacheControl: false,
      setHeaders: (response) => response.setHeader('cache-control', 'no-store')
    })(req, res, (err?: { status?: number }) => reject(err?.status))
  }

  private summary(build: SessionBuild): PreviewSummary {
    const pdf = build.ctx.options.output === OutputFileType.PDF

    return {
      version: build.version,
      ms: build.ms,
      pdf,
      pages: pdf ? (build.output.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length : 0,
      signed: Boolean(build.ctx.signature)
    }
  }

  private send(event: string, data: unknown): void {
    for (const client of this.clients) {
      client.write(this.event(event, data))
    }
  }

  private event(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  }
}
