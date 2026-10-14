import { chmod, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BrowserNotFoundError, discoverBrowser } from '../src/services/renderer/browser.js'

describe('discoverBrowser', () => {
  let directory: string

  const executable = async(name: string): Promise<string> => {
    const path = join(directory, name)

    await writeFile(path, '')
    await chmod(path, 0o755)

    return path
  }

  beforeEach(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-browser-'))
  })

  afterEach(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it('prefers the explicit path', async() => {
    const custom = await executable('custom-chrome')

    await executable('brave')

    expect(discoverBrowser(custom, { PATH: directory })).toBe(custom)
  })

  it('fails when the explicit path does not exist instead of falling back', async() => {
    await executable('brave')

    expect(() => discoverBrowser(join(directory, 'nope'), { PATH: directory })).toThrow(BrowserNotFoundError)
  })

  it('uses the environment overrides before searching', async() => {
    const override = await executable('env-chrome')

    await executable('brave')

    expect(discoverBrowser(undefined, { PATH: directory, CHROME_PATH: override })).toBe(override)
  })

  it('finds brave on PATH before chrome', async() => {
    await executable('google-chrome')

    const brave = await executable('brave')

    expect(discoverBrowser(undefined, { PATH: directory })).toBe(brave)
  })

  it('lists every candidate it tried when nothing is found', () => {
    expect(() => discoverBrowser(undefined, { PATH: directory })).toThrow(expect.objectContaining({ tried: expect.arrayContaining(['brave', 'google-chrome']) }))
  })
})
