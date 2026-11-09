/// <reference lib="dom" />
import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type { HTTPRequest, Page } from 'puppeteer-core'
import { fileURLToPath, pathToFileURL } from 'url'

import { BrowserService } from './browser.service.js'
import { mimeType, resolveConfined } from '../template/assets.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { PAGE_BREAK_CLASS } from '@constants'
import type { RenderedDocument, RendererOptions, RendererResult } from '@interfaces'

@Injectable()
export class RendererService {
  private static readonly ORIGIN = 'http://md-printer.local'
  private static readonly DOCUMENT = '/__document.html'
  private static readonly SECTION = 'data-md-printer-section'

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
      const sections = await this.split(page)
      const pdf = options.continuous ? await this.continuous(page, options, sections) : await this.paginated(page, rendered, options)

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
      const path = fileURLToPath(new URL(`.${url.pathname}`, pathToFileURL(`${base}/`)))
      const confined = await resolveConfined(path, base)
      const body = confined && (await readFile(confined).catch((): undefined => undefined))

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

  /**
   * Cuts the body into top-level sections at every page break, cloning the containers a break sits in, so a break works anywhere: inside
   * flex or grid layouts, where CSS fragmentation ignores it, and in continuous mode, where every section becomes a page of its own height.
   */
  private split(page: Page): Promise<number> {
    return page.evaluate(
      (selector, attribute) => {
        const markers = Array.from(document.body.querySelectorAll(selector))

        if (!markers.length) {
          return 1
        }

        const sections = markers.map((marker) => {
          const range = document.createRange()
          const section = document.createElement('div')

          range.setStart(document.body, 0)
          range.setEndBefore(marker)
          section.append(range.extractContents())
          marker.remove()

          return section
        })

        sections.push(document.createElement('div'))
        sections.at(-1).append(...Array.from(document.body.childNodes))
        sections.forEach((section, index) => section.setAttribute(attribute, String(index)))
        document.body.replaceChildren(...sections)

        const style = document.createElement('style')

        style.textContent = `[${attribute}]:not(:last-child) { break-after: page; }`
        document.head.append(style)

        return sections.length
      },
      `.${PAGE_BREAK_CLASS}`,
      RendererService.SECTION
    )
  }

  private paginated(page: Page, rendered: RenderedDocument, options: RendererOptions): Promise<Uint8Array> {
    return page.pdf({
      ...options.pdf,
      displayHeaderFooter: options.pdf.displayHeaderFooter ?? Boolean(rendered.header || rendered.footer),
      headerTemplate: rendered.header ?? '<span></span>',
      footerTemplate: rendered.footer ?? '<span></span>'
    })
  }

  /**
   * Prints everything as one tall page. Chrome itself resolves the paper size (from a one page probe print) and the margins (as CSS lengths),
   * so md-printer never has to know paper formats or length units.
   */
  private async continuous(page: Page, options: RendererOptions, sections: number): Promise<Uint8Array> {
    const [, points] = Buffer.from(
      await page.pdf({
        ...options.pdf,
        displayHeaderFooter: false,
        pageRanges: '1'
      })
    )
      .toString('latin1')
      .match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)/)
    const width = Math.round((Number(points) * 96) / 72)
    const margin = await page.evaluate(
      (lengths) => {
        const probe = document.createElement('div')

        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        Object.assign(probe.style, {
          marginTop: lengths?.top,
          marginRight: lengths?.right,
          marginBottom: lengths?.bottom,
          marginLeft: lengths?.left
        })
        document.body.append(probe)

        const style = getComputedStyle(probe)
        const resolved = {
          top: parseFloat(style.marginTop),
          right: parseFloat(style.marginRight),
          bottom: parseFloat(style.marginBottom),
          left: parseFloat(style.marginLeft)
        }

        probe.remove()

        return resolved
      },
      // Puppeteer reads numbers as pixels, CSS would drop them as unitless lengths
      Object.fromEntries(Object.entries(options.pdf.margin ?? {}).map(([side, length]) => [side, typeof length === 'number' ? `${length}px` : length]))
    )

    await page.setViewport({ width: Math.max(Math.round(width - margin.left - margin.right), 1), height: 800 })

    const heights = await page.evaluate(
      async(attribute, single) => {
        await document.fonts.ready

        return (single ? [document.body] : Array.from(document.body.querySelectorAll(`:scope > [${attribute}]`))).map((element) => {
          const top = element.getBoundingClientRect().top

          return Math.max(
            element.scrollHeight,
            single ? document.documentElement.scrollHeight : 0,
            ...Array.from(element.querySelectorAll('*')).map((child) => child.getBoundingClientRect().bottom - top)
          )
        })
      },
      RendererService.SECTION,
      sections === 1
    )

    // the extra centimetre keeps the last line from spilling onto a second page
    const totals = heights.map((height) => Math.ceil(height + margin.top + margin.bottom + 96 / 2.54))

    // Chromium stores the page size as 16-bit points and fails to print anything taller
    if (totals.some((total) => total * 0.75 > 65_535)) {
      this.logger.warn('Content is %dpx tall, which is more than a single PDF page can hold, falling back to paginated output.', Math.max(...totals))

      return page.pdf({ ...options.pdf, displayHeaderFooter: false })
    }

    const pdf = { ...options.pdf, displayHeaderFooter: false }

    delete pdf.format
    delete pdf.landscape

    if (sections === 1) {
      return page.pdf({
        ...pdf,
        width: `${width}px`,
        height: `${totals[0]}px`,
        pageRanges: '1'
      })
    }

    // every section is a named page, so Chromium prints each one at its own height
    await page.addStyleTag({
      content: totals
        .map((total, index) => `@page md-printer-${index} { size: ${width}px ${total}px; } [${RendererService.SECTION}="${index}"] { page: md-printer-${index}; }`)
        .join('\n')
    })

    return page.pdf({ ...pdf, preferCSSPageSize: true })
  }
}
