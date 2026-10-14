import { accessSync, constants } from 'fs'
import { delimiter, join } from 'path'

import type { BrowserEnvironment } from '@interfaces'

export class BrowserNotFoundError extends Error {
  constructor(public readonly tried: string[]) {
    super(['Can not find a Chromium-based browser to print with.', `Tried: ${tried.join(', ')}`, 'Pass --browser <path> or set PUPPETEER_EXECUTABLE_PATH.'].join('\n'))
  }
}

export function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)

    return true
  } catch {
    return false
  }
}

/**
 * Resolves the browser executable: explicit path, environment overrides, then Brave, Chrome, Chromium and Edge by PATH name and well-known install locations.
 */
export function discoverBrowser(explicit: string | undefined, { env, executable }: BrowserEnvironment): string {
  const tried: string[] = []

  for (const path of [explicit, env.PUPPETEER_EXECUTABLE_PATH, env.CHROME_PATH].filter(Boolean)) {
    tried.push(path)

    if (executable(path)) {
      return path
    }

    if (path === explicit) {
      throw new BrowserNotFoundError(tried)
    }
  }

  const directories = (env.PATH ?? '').split(delimiter).filter(Boolean)

  for (const { names, paths } of [
    { names: ['brave', 'brave-browser', 'brave-browser-stable'], paths: ['/opt/brave.com/brave/brave', '/opt/brave-bin/brave', '/snap/bin/brave'] },
    { names: ['google-chrome-stable', 'google-chrome'], paths: ['/opt/google/chrome/chrome'] },
    { names: ['chromium', 'chromium-browser'], paths: ['/usr/bin/chromium', '/usr/lib/chromium/chromium', '/snap/bin/chromium'] },
    { names: ['microsoft-edge-stable', 'microsoft-edge'], paths: ['/opt/microsoft/msedge/msedge'] }
  ]) {
    for (const name of names) {
      const path = directories.map((directory) => join(directory, name)).find(executable)

      if (path) {
        return path
      }

      tried.push(name)
    }

    for (const path of paths) {
      tried.push(path)

      if (executable(path)) {
        return path
      }
    }
  }

  throw new BrowserNotFoundError(tried)
}
