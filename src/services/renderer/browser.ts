import which from 'which'

export class BrowserNotFoundError extends Error {
  constructor(public readonly tried: string[]) {
    super(['Can not find a Chromium-based browser to print with.', `Tried: ${tried.join(', ')}`, 'Pass --browser <path> or set PUPPETEER_EXECUTABLE_PATH.'].join('\n'))
  }
}

/**
 * Resolves the browser executable: explicit path, environment overrides, then Brave, Chrome, Chromium and Edge from PATH.
 */
export function discoverBrowser(explicit: string | undefined, env: NodeJS.ProcessEnv): string {
  // an explicit path never falls back, so a typo is not silently replaced by another browser
  const candidates = explicit
    ? [explicit]
    : [
      env.PUPPETEER_EXECUTABLE_PATH,
      env.CHROME_PATH,
      'brave',
      'brave-browser',
      'brave-browser-stable',
      'google-chrome-stable',
      'google-chrome',
      'chromium',
      'chromium-browser',
      'microsoft-edge-stable',
      'microsoft-edge'
    ].filter(Boolean)

  for (const candidate of candidates) {
    const path = which.sync(candidate, { path: env.PATH, nothrow: true })

    if (path) {
      return path
    }
  }

  throw new BrowserNotFoundError(candidates)
}
