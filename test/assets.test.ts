import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises'
import type { IncomingMessage } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isLoopbackRequest } from '../src/services/loopback.js'
import { inlineCss, inlineHtml } from '../src/services/template/assets.js'
import type { LoggerService } from '@cenk1cenk2/oclif-common'
import { OutputFileType } from '@constants'
import type { MdPrinterCtx, RenderedDocument } from '@interfaces'
import { PrinterService } from '@services'

describe('inlineHtml', () => {
  let directory: string
  let base: string
  const inside = `data:image/png;base64,${Buffer.from('inside').toString('base64')}`

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-assets-'))
    base = join(directory, 'document')

    await mkdir(base)
    await writeFile(join(base, 'inside.png'), 'inside')
    await writeFile(join(base, '..notes.png'), 'notes')
    await writeFile(join(base, 'with space.png'), 'space')
    await writeFile(join(directory, 'outside.png'), 'outside')
    await symlink(join(directory, 'outside.png'), join(base, 'link.png'))
  })

  afterAll(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it('inlines local images as data URIs and returns their paths', async() => {
    expect(await inlineHtml('<img src="inside.png">', base)).toEqual({ content: `<img src="${inside}">`, assets: [join(base, 'inside.png')] })
  })

  it('inlines every srcset candidate', async() => {
    expect((await inlineHtml('<img srcset="inside.png 1x, missing.png 2x">', base)).content).toBe(`<img srcset="${inside} 1x, missing.png 2x">`)
  })

  it('leaves code samples untouched', async() => {
    const markup = '<p><code>url(inside.png)</code></p><pre><code>&lt;img src="inside.png"></code></pre>'

    expect(await inlineHtml(markup, base)).toEqual({ content: markup, assets: [] })
  })

  it('inlines style attributes and style elements', async() => {
    const { content } = await inlineHtml('<style>a { background: url(inside.png) }</style><p style="background: url(inside.png)"></p>', base)

    expect(content.split(inside)).toHaveLength(3)
  })

  it('keeps confined content inside its directory', async() => {
    for (const reference of ['../outside.png', join(directory, 'outside.png'), 'link.png']) {
      expect((await inlineHtml(`<img src="${reference}">`, base, { confined: true })).content).toBe(`<img src="${reference}">`)
    }
  })

  it('reads names starting with two dots and percent-encoded file URLs when confined', async() => {
    const encoded = pathToFileURL(join(base, 'with space.png')).href

    expect(encoded).toContain('%20')
    expect((await inlineHtml(`<img src="..notes.png"><img src="${encoded}">`, base, { confined: true })).assets).toEqual([join(base, '..notes.png'), join(base, 'with space.png')])
  })

  it('leaves an unreachable remote asset in place', async() => {
    expect((await inlineHtml('<img src="http://127.0.0.1:1/logo.png">', directory, { remote: true })).content).toBe('<img src="http://127.0.0.1:1/logo.png">')
  })

  it('returns the assets HTML output read, so a preview session watches them', async() => {
    const printer = new PrinterService(undefined, { setup: (): void => undefined } as unknown as LoggerService, undefined, undefined, undefined, undefined, undefined, undefined)

    expect(
      (
        await printer.output(
          { input: { directory: base }, options: { output: OutputFileType.HTML } } as MdPrinterCtx,
          {
            html: '<!doctype html><html><body><img src="inside.png"></body></html>'
          } as RenderedDocument
        )
      ).assets
    ).toEqual([join(base, 'inside.png')])
  })

  it('inlines url() references in stylesheets', async() => {
    const { content, assets } = await inlineCss('.logo { background: url("inside.png"); } .data { background: url(data:image/png;base64,AA==); }', base)

    expect(content).toContain(`url("${inside}")`)
    expect(content).toContain('url("data:image/png;base64,AA==")')
    expect(assets).toEqual([join(base, 'inside.png')])
  })
})

describe('isLoopbackRequest', () => {
  const request = (headers: IncomingMessage['headers']): IncomingMessage => ({ headers }) as IncomingMessage

  it.each([
    [{ host: '127.0.0.1:4000' }, true],
    [{ host: 'localhost:4000', origin: 'http://localhost:4000' }, true],
    [{ host: '[::1]:4000' }, true],
    [{ host: 'evil.example:4000' }, false],
    [{ host: '127.0.0.1:4000', origin: 'https://evil.example' }, false],
    [{}, false]
  ])('%o is %s', (headers, expected) => {
    expect(isLoopbackRequest(request(headers))).toBe(expected)
  })

  it.each([
    [{ host: '127.0.0.1:4000', origin: 'http://127.0.0.1:4000' }, true],
    [{ host: '127.0.0.1:4000', origin: 'http://localhost:4000' }, false],
    [{ host: '127.0.0.1:4000', origin: 'http://127.0.0.1:5000' }, false],
    [{ host: '127.0.0.1:4000' }, false]
  ])('%o is %s when http://127.0.0.1:4000 is expected', (headers, expected) => {
    expect(isLoopbackRequest(request(headers), 'http://127.0.0.1:4000')).toBe(expected)
  })
})
