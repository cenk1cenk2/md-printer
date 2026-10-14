import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import type { IncomingMessage } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isLoopbackRequest } from '../src/services/loopback.js'
import { inlineAssets } from '../src/services/template/assets.js'

describe('inlineAssets', () => {
  let directory: string

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-assets-'))

    await mkdir(join(directory, 'document'))
    await writeFile(join(directory, 'document', 'inside.png'), 'inside')
    await writeFile(join(directory, 'outside.png'), 'outside')
  })

  afterAll(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it('inlines local images as data URIs', async() => {
    expect(await inlineAssets('<img src="inside.png">', join(directory, 'document'))).toBe(`<img src="data:image/png;base64,${Buffer.from('inside').toString('base64')}">`)
  })

  it('keeps confined content inside its directory', async() => {
    const base = join(directory, 'document')

    expect(await inlineAssets('<img src="../outside.png">', base, { confined: true })).toBe('<img src="../outside.png">')
    expect(await inlineAssets(`<img src="${join(directory, 'outside.png')}">`, base, { confined: true })).toBe(`<img src="${join(directory, 'outside.png')}">`)
  })

  it('leaves an unreachable remote asset in place', async() => {
    expect(await inlineAssets('<img src="http://127.0.0.1:1/logo.png">', directory, { remote: true })).toBe('<img src="http://127.0.0.1:1/logo.png">')
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
})
