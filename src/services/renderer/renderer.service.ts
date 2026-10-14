/// <reference lib="dom" />
import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import { relative, resolve } from 'path'
import type { HTTPRequest, Page, PDFOptions } from 'puppeteer-core'

import { BrowserService } from './browser.service.js'
import { pixels } from './units.js'
import { mimeType } from '../template/assets.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import type { MediaType } from '@constants'
import type { RenderedDocument } from '@interfaces'

export interface RendererOptions {
  directory: string
  pdf: PDFOptions
  media: MediaType
  continuous: boolean
}

export interface RendererResult {
  pdf: Buffer
  assets: string[]
}

@Injectable()
export class RendererService {
  private static readonly ORIGIN = 'http://md-printer.local'
  private static readonly DOCUMENT = '/__document.html'
  private static readonly MAX_CONTINUOUS_HEIGHT = 80_000

  constructor(
    private readonly logger: LoggerService,
    private readonly browser: BrowserService
  ) {
    this.logger.setup(this.constructor.name)
  }

  public async render(rendered: RenderedDocument, options: RendererOptions): Promise<RendererResult> {
    const page = await (await this.browser.get()).newPage()

    try {
      const assets = await this.load(page, rendered, options)
      const pdf = options.continuous ? await this.continuous(page, options) : await this.paginated(page, rendered, options)

      return { pdf: Buffer.from(pdf), assets }
    } finally {
      await page.close()
    }
  }

  private async load(page: Page, rendered: RenderedDocument, options: RendererOptions): Promise<string[]> {
    const assets = new Set<string>()
    const base = resolve(options.directory)

    await page.setRequestInterception(true)

    page.on('request', (request) => {
      this.intercept(request, rendered, base, assets).catch(async(err) => {
        this.logger.debug('Request handling failed for %s: %s', request.url(), err)

        await request.abort().catch((): undefined => undefined)
      })
    })

    await page.emulateMediaType(options.media)
    await page.goto(RendererService.ORIGIN + RendererService.DOCUMENT, { waitUntil: 'load' })
    await page.evaluate(async() => {
      for (const image of Array.from(document.images)) {
        image.loading = 'eager'
      }

      await document.fonts.ready
      await Promise.all(Array.from(document.images).map((image) => image.decode().catch((): undefined => undefined)))
    })

    return [...assets]
  }

  /**
   * Answers every request of the page: the document itself, local files under the base directory, and lets every other origin through.
   */
  private async intercept(request: HTTPRequest, rendered: RenderedDocument, base: string, assets: Set<string>): Promise<void> {
    const url = new URL(request.url())

    if (url.origin !== RendererService.ORIGIN) {
      await request.continue()
    } else if (url.pathname === '/favicon.ico') {
      await request.respond({ status: 204, body: '' })
    } else if (url.pathname === RendererService.DOCUMENT) {
      await request.respond({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: rendered.html
      })
    } else {
      const path = resolve(base, decodeURIComponent(url.pathname.slice(1)))
      const body = relative(base, path).startsWith('..') ? undefined : await readFile(path).catch((): undefined => undefined)

      if (body) {
        assets.add(path)

        await request.respond({
          status: 200,
          contentType: mimeType(path),
          body
        })
      } else {
        this.logger.warn('Can not load asset: %s', path)

        await request.respond({ status: 404, body: '' })
      }
    }
  }

  private paginated(page: Page, rendered: RenderedDocument, options: RendererOptions): Promise<Uint8Array> {
    const headerFooter = Boolean(rendered.header || rendered.footer)

    return page.pdf({
      ...options.pdf,
      displayHeaderFooter: options.pdf.displayHeaderFooter ?? headerFooter,
      headerTemplate: rendered.header ?? '<span></span>',
      footerTemplate: rendered.footer ?? '<span></span>'
    })
  }

  private async continuous(page: Page, options: RendererOptions): Promise<Uint8Array> {
    const { width, margin } = pixels(options.pdf)

    await page.setViewport({ width: Math.ceil(Math.max(width - margin.left - margin.right, 1)), height: 800 })

    const height = await page.evaluate(async() => {
      await document.fonts.ready

      const top = document.body.getBoundingClientRect().top

      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        ...Array.from(document.body.querySelectorAll('*')).map((element) => element.getBoundingClientRect().bottom - top)
      )
    })

    // the extra centimetre keeps the last line from spilling onto a second page
    const total = Math.ceil(height + margin.top + margin.bottom + 96 / 2.54)

    if (total > RendererService.MAX_CONTINUOUS_HEIGHT) {
      this.logger.warn('Content is %dpx tall, which is more than a single PDF page can hold, falling back to paginated output.', total)

      return page.pdf({ ...options.pdf, displayHeaderFooter: false })
    }

    const pdf = { ...options.pdf }

    delete pdf.format
    delete pdf.landscape

    return page.pdf({
      ...pdf,
      displayHeaderFooter: false,
      width: `${width}px`,
      height: `${total}px`,
      pageRanges: '1'
    })
  }
}
