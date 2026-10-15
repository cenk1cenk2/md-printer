import { chmod, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { identity, sign } from './signature.fixtures.js'
import type { CommandContext, LoggerService } from '@cenk1cenk2/oclif-common'
import type { BrowserService } from '@services'
import { ATrustAdapter } from '@services'

describe('ATrustAdapter', () => {
  let directory: string
  let controller: AbortController
  let adapter: ATrustAdapter
  let cms: Buffer
  const logger = {
    setup: (): void => undefined,
    debug: (): void => undefined,
    info: (): void => undefined,
    warn: (): void => undefined
  } as unknown as LoggerService

  /**
   * The arguments the stand-in browser was started with.
   */
  async function opened(): Promise<string[]> {
    return (await vi.waitFor(() => readFile(join(directory, 'args'), 'utf-8'), { timeout: 5000 })).trim().split('\n')
  }

  function collect(): Promise<Buffer> {
    return (adapter as unknown as { collect: (login: string) => Promise<Buffer> }).collect('https://service.a-trust.at/identification.aspx?sid=1')
  }

  function paste(page: string, signature: string): Promise<Response> {
    return fetch(new URL('/signature', page), {
      method: 'POST',
      headers: { origin: new URL(page).origin },
      body: `<sl:CMSSignature>${signature}</sl:CMSSignature>`
    })
  }

  beforeAll(async() => {
    cms = await sign(new ArrayBuffer(8), await identity('Alice', 1, { name: 'ECDSA', namedCurve: 'P-256' }))
  })

  beforeEach(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-a-trust-'))
    controller = new AbortController()

    const browser = join(directory, 'browser')

    await writeFile(browser, ['#!/bin/sh', `printf '%s\\n' "$@" > "${join(directory, 'args')}"`].join('\n'))
    await chmod(browser, 0o755)

    adapter = new ATrustAdapter(logger, { signal: controller.signal } as CommandContext<never>, { executable: (): string => browser } as unknown as BrowserService)
  })

  afterEach(async() => {
    controller.abort()

    await rm(directory, { recursive: true, force: true })
  })

  it('opens the session in a new browser window and takes the pasted signature', async() => {
    const signature = collect()
    const [flag, page] = await opened()

    expect(flag).toBe('--new-window')
    expect((await paste(page, cms.toString('base64'))).status).toBe(200)
    expect(await signature).toEqual(cms)
  })

  it('refuses an incomplete paste and keeps the session open for another one', async() => {
    const signature = collect()
    const [, page] = await opened()
    const response = await paste(page, cms.subarray(0, 513).toString('base64'))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe(`The pasted signature is incomplete (got 513 of ${cms.length} bytes), copy the whole signature text from the A-Trust page.`)

    expect((await paste(page, cms.toString('base64'))).status).toBe(200)
    expect(await signature).toEqual(cms)
  })

  it('stops waiting when signing is aborted', async() => {
    const signature = collect()

    await opened()
    controller.abort()

    await expect(signature).rejects.toThrow('Signing is aborted.')
  })
})
