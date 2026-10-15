import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
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
  let cms: Buffer
  const logger = {
    setup: (): void => undefined,
    debug: (): void => undefined,
    info: (): void => undefined,
    warn: (): void => undefined
  } as unknown as LoggerService

  /**
   * A stand-in browser that records its arguments, then stays open or exits right away.
   */
  async function browser(stays: boolean): Promise<BrowserService> {
    const path = join(directory, 'browser')

    await writeFile(path, ['#!/bin/sh', `printf '%s\\n' "$@" > "${join(directory, 'args')}"`, stays ? 'exec sleep 30' : 'exit 0'].join('\n'))
    await chmod(path, 0o755)

    return { executable: (): string => path } as unknown as BrowserService
  }

  async function opened(): Promise<Record<string, string>> {
    const args = await vi.waitFor(() => readFile(join(directory, 'args'), 'utf-8'), { timeout: 5000 })

    return Object.fromEntries(
      args
        .trim()
        .split('\n')
        .map((arg) => arg.replace(/^--/, '').split(/=(.*)/s))
    )
  }

  function collect(adapter: ATrustAdapter): Promise<Buffer> {
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
  })

  afterEach(async() => {
    controller.abort()

    await rm(directory, { recursive: true, force: true })
  })

  it('opens the session in an app window with a fresh profile and removes it once the signature arrives', async() => {
    const adapter = new ATrustAdapter(logger, { signal: controller.signal } as CommandContext<never>, await browser(true))
    const signature = collect(adapter)
    const args = await opened()

    expect(Object.keys(args)).toEqual(expect.arrayContaining(['no-first-run', 'no-default-browser-check']))
    await expect(access(args['user-data-dir'])).resolves.toBeUndefined()

    expect((await paste(args.app, cms.toString('base64'))).status).toBe(200)
    expect(await signature).toEqual(cms)
    await expect(access(args['user-data-dir'])).rejects.toThrow()
  })

  it('refuses an incomplete paste and keeps the session open for another one', async() => {
    const adapter = new ATrustAdapter(logger, { signal: controller.signal } as CommandContext<never>, await browser(true))
    const signature = collect(adapter)
    const { app } = await opened()
    const response = await paste(app, cms.subarray(0, 513).toString('base64'))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe(`The pasted signature is incomplete (got 513 of ${cms.length} bytes), copy the whole signature text from the A-Trust page.`)

    expect((await paste(app, cms.toString('base64'))).status).toBe(200)
    expect(await signature).toEqual(cms)
  })

  it('fails when the window is closed before the signature arrives', async() => {
    const adapter = new ATrustAdapter(logger, { signal: controller.signal } as CommandContext<never>, await browser(false))
    const signature = collect(adapter)

    await expect(signature).rejects.toThrow('The signing window is closed before the signature arrived.')
    await expect(access((await opened())['user-data-dir'])).rejects.toThrow()
  })

  it('closes the window when signing is aborted', async() => {
    const adapter = new ATrustAdapter(logger, { signal: controller.signal } as CommandContext<never>, await browser(true))
    const signature = collect(adapter)
    const args = await opened()

    controller.abort()

    await expect(signature).rejects.toThrow('Signing is aborted.')
    await expect(access(args['user-data-dir'])).rejects.toThrow()
  })
})
