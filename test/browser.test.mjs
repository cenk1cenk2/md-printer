import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BrowserNotFoundError, discoverBrowser } from '../dist/services/renderer/browser.mjs'

describe('discoverBrowser', () => {
  const environment = (executables, overrides = {}) => ({
    platform: 'linux',
    env: { PATH: '/usr/local/bin:/usr/bin' },
    home: '/home/user',
    executable: (path) => executables.includes(path),
    ...overrides
  })

  it('prefers the explicit path', () => {
    assert.equal(discoverBrowser('/opt/custom/chrome', environment(['/opt/custom/chrome', '/usr/bin/brave'])), '/opt/custom/chrome')
  })

  it('fails when the explicit path does not exist instead of falling back', () => {
    assert.throws(() => discoverBrowser('/nope', environment(['/usr/bin/brave'])), BrowserNotFoundError)
  })

  it('uses the environment overrides before searching', () => {
    assert.equal(
      discoverBrowser(undefined, environment(['/env/chrome', '/usr/bin/brave'], { env: { PATH: '/usr/bin', CHROME_PATH: '/env/chrome' } })),
      '/env/chrome'
    )
  })

  it('finds brave on PATH before chrome', () => {
    assert.equal(discoverBrowser(undefined, environment(['/usr/bin/google-chrome', '/usr/bin/brave'])), '/usr/bin/brave')
  })

  it('falls back to well-known install locations', () => {
    assert.equal(discoverBrowser(undefined, environment(['/opt/brave-bin/brave'])), '/opt/brave-bin/brave')
  })

  it('finds macOS application bundles', () => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

    assert.equal(discoverBrowser(undefined, environment([chrome], { platform: 'darwin' })), chrome)
  })

  it('lists every candidate it tried when nothing is found', () => {
    assert.throws(
      () => discoverBrowser(undefined, environment([])),
      (err) => err instanceof BrowserNotFoundError && err.tried.includes('brave') && err.tried.includes('/opt/google/chrome/chrome')
    )
  })
})
