import { describe, expect, it } from 'vitest'

import type { BrowserEnvironment } from '../src/interfaces/index.js'
import { BrowserNotFoundError, discoverBrowser } from '../src/services/renderer/browser.js'

describe('discoverBrowser', () => {
  const environment = (executables: string[], env: NodeJS.ProcessEnv = { PATH: '/usr/local/bin:/usr/bin' }): BrowserEnvironment => ({
    env,
    executable: (path) => executables.includes(path)
  })

  it('prefers the explicit path', () => {
    expect(discoverBrowser('/opt/custom/chrome', environment(['/opt/custom/chrome', '/usr/bin/brave']))).toBe('/opt/custom/chrome')
  })

  it('fails when the explicit path does not exist instead of falling back', () => {
    expect(() => discoverBrowser('/nope', environment(['/usr/bin/brave']))).toThrow(BrowserNotFoundError)
  })

  it('uses the environment overrides before searching', () => {
    expect(discoverBrowser(undefined, environment(['/env/chrome', '/usr/bin/brave'], { PATH: '/usr/bin', CHROME_PATH: '/env/chrome' }))).toBe('/env/chrome')
  })

  it('finds brave on PATH before chrome', () => {
    expect(discoverBrowser(undefined, environment(['/usr/bin/google-chrome', '/usr/bin/brave']))).toBe('/usr/bin/brave')
  })

  it('falls back to well-known install locations', () => {
    expect(discoverBrowser(undefined, environment(['/opt/brave-bin/brave']))).toBe('/opt/brave-bin/brave')
  })

  it('lists every candidate it tried when nothing is found', () => {
    expect(() => discoverBrowser(undefined, environment([]))).toThrow(expect.objectContaining({ tried: expect.arrayContaining(['brave', '/opt/google/chrome/chrome']) }))
  })
})
