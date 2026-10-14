import { Injectable } from '@nestjs/common'
import { spawn } from 'child_process'
import { mkdtemp, readFile, rm } from 'fs/promises'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join, relative, resolve } from 'path'

import type { SessionBuild } from './session.service.js'
import { mimeType } from '../template/assets.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'

export interface PreviewOptions {
  host: string
  port: number
}

interface PreviewError {
  message: string
  frame?: string
  file?: string
}

/**
 * Serves the live preview: a shell page with the HTML and the printed PDF side by side, updated over server-sent events after every build.
 */
@Injectable()
export class PreviewService {
  private static readonly SHELL = './preview.html'

  private server?: Server
  private clients = new Set<ServerResponse>()
  private build?: SessionBuild
  private error?: PreviewError
  private profile?: string

  constructor(private readonly logger: LoggerService) {
    this.logger.setup(this.constructor.name)
  }

  public async listen(options: PreviewOptions): Promise<string> {
    const shell = await readFile(new URL(PreviewService.SHELL, import.meta.url))

    this.server = createServer((req, res) => {
      this.handle(req, res, shell, options).catch((err) => {
        this.logger.debug('Preview request failed: %s', err)

        res.writeHead(500)
        res.end()
      })
    })

    await new Promise<void>((done) => this.server.listen(options.port, options.host, done))

    const { port } = this.server.address() as AddressInfo

    return `http://${options.host}:${port}/`
  }

  public building(): void {
    this.send('building', {})
  }

  public ready(build: SessionBuild): void {
    this.build = build
    this.error = undefined

    this.send('ready', this.summary(build))
  }

  public failed(err: Error & { frame?: string; filename?: string }): void {
    this.error = {
      message: err.message,
      frame: err.frame,
      file: err.filename
    }

    this.send('failed', this.error)
  }

  /**
   * Opens the preview in an app window of the given browser with a throwaway profile, resolving once the window is closed.
   */
  public async open(executable: string, url: string): Promise<void> {
    this.profile = await mkdtemp(join(tmpdir(), 'md-printer-preview-'))

    const browser = spawn(executable, [`--app=${url}`, `--user-data-dir=${this.profile}`, '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore' })

    await new Promise<void>((done) => {
      browser.on('exit', () => done())
      browser.on('error', (err) => {
        this.logger.warn('Can not open the preview window, open it manually: %s (%s)', url, err.message)
      })
    })
  }

  public async close(): Promise<void> {
    for (const client of this.clients) {
      client.end()
    }

    await new Promise<void>((done) => (this.server ? this.server.close(() => done()) : done()))

    if (this.profile) {
      await rm(this.profile, { recursive: true, force: true })
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse, shell: Buffer, options: PreviewOptions): Promise<void> {
    if (!this.trusted(req, options)) {
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
        if (this.build?.ctx.options.output !== 'pdf') {
          res.writeHead(404)

          return void res.end()
        }

        res.writeHead(200, { ['content-type']: 'application/pdf', ['cache-control']: 'no-store' })

        return void res.end(this.build.output)

      default:
        return this.asset(url.pathname, res)
    }
  }

  private async asset(pathname: string, res: ServerResponse): Promise<void> {
    const base = this.build?.ctx.input.directory

    if (!base) {
      res.writeHead(404)

      return void res.end()
    }

    const path = resolve(base, decodeURIComponent(pathname.slice(1)))

    if (relative(base, path).startsWith('..')) {
      res.writeHead(403)

      return void res.end()
    }

    const body = await readFile(path).catch((): undefined => undefined)

    if (!body) {
      res.writeHead(404)

      return void res.end()
    }

    res.writeHead(200, { ['content-type']: mimeType(path), ['cache-control']: 'no-store' })
    res.end(body)
  }

  /**
   * Only answers requests addressed to the preview host, so a page on another site can not reach it through DNS rebinding.
   */
  private trusted(req: IncomingMessage, options: PreviewOptions): boolean {
    const host = req.headers.host?.replace(/:\d+$/, '')

    return [options.host, 'localhost', '127.0.0.1', '[::1]'].includes(host)
  }

  private summary(build: SessionBuild): Record<string, unknown> {
    const pdf = build.ctx.options.output === 'pdf'

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
