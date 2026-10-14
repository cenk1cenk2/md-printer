import { accessSync, constants } from 'fs'
import { delimiter, join } from 'path'

export interface BrowserEnvironment {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  home: string
  executable: (path: string) => boolean
}

interface BrowserCandidates {
  names: string[]
  paths: string[]
}

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
export function discoverBrowser(explicit: string | undefined, environment: BrowserEnvironment): string {
  const tried: string[] = []

  for (const path of [explicit, environment.env.PUPPETEER_EXECUTABLE_PATH, environment.env.CHROME_PATH].filter(Boolean)) {
    tried.push(path)

    if (environment.executable(path)) {
      return path
    }

    if (path === explicit) {
      throw new BrowserNotFoundError(tried)
    }
  }

  const directories = (environment.env.PATH ?? '').split(delimiter).filter(Boolean)
  const extensions = environment.platform === 'win32' ? ['.exe', ''] : ['']

  for (const { names, paths } of candidates(environment)) {
    for (const name of names) {
      for (const directory of directories) {
        for (const extension of extensions) {
          const path = join(directory, name + extension)

          if (environment.executable(path)) {
            return path
          }
        }
      }

      tried.push(name)
    }

    for (const path of paths) {
      tried.push(path)

      if (environment.executable(path)) {
        return path
      }
    }
  }

  throw new BrowserNotFoundError(tried)
}

function candidates({ platform, env, home }: BrowserEnvironment): BrowserCandidates[] {
  switch (platform) {
    case 'darwin': {
      const app = (name: string): string[] => ['/Applications', join(home, 'Applications')].map((root) => join(root, `${name}.app`, 'Contents', 'MacOS', name))

      return [
        { names: [], paths: app('Brave Browser') },
        { names: [], paths: app('Google Chrome') },
        { names: [], paths: app('Chromium') },
        { names: [], paths: app('Microsoft Edge') }
      ]
    }

    case 'win32': {
      const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean)
      const app = (...segments: string[]): string[] => roots.map((root) => join(root, ...segments))

      return [
        { names: ['brave'], paths: app('BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') },
        { names: ['chrome'], paths: app('Google', 'Chrome', 'Application', 'chrome.exe') },
        { names: ['chromium'], paths: app('Chromium', 'Application', 'chrome.exe') },
        { names: ['msedge'], paths: app('Microsoft', 'Edge', 'Application', 'msedge.exe') }
      ]
    }

    default:
      return [
        { names: ['brave', 'brave-browser', 'brave-browser-stable'], paths: ['/opt/brave.com/brave/brave', '/opt/brave-bin/brave', '/snap/bin/brave'] },
        { names: ['google-chrome-stable', 'google-chrome'], paths: ['/opt/google/chrome/chrome'] },
        { names: ['chromium', 'chromium-browser'], paths: ['/usr/bin/chromium', '/usr/lib/chromium/chromium', '/snap/bin/chromium'] },
        { names: ['microsoft-edge-stable', 'microsoft-edge'], paths: ['/opt/microsoft/msedge/msedge'] }
      ]
  }
}
