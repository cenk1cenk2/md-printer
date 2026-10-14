import type { OnModuleDestroy } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { homedir } from 'os'
import type { Browser } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

import { discoverBrowser, isExecutable } from './browser.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'

/**
 * Owns the browser: discovers the executable, launches one shared instance on first use and closes it when the application shuts down.
 */
@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Promise<Browser>
  private explicit?: string

  constructor(private readonly logger: LoggerService) {
    this.logger.setup(this.constructor.name)
  }

  public use(explicit?: string): void {
    this.explicit = explicit
  }

  public executable(): string {
    return discoverBrowser(this.explicit, {
      platform: process.platform,
      env: process.env,
      home: homedir(),
      executable: isExecutable
    })
  }

  public get(): Promise<Browser> {
    this.browser ??= this.launch().catch((err) => {
      this.browser = undefined

      throw err
    })

    return this.browser
  }

  public async onModuleDestroy(): Promise<void> {
    const browser = await this.browser?.catch((): undefined => undefined)

    this.browser = undefined

    await browser?.close()
  }

  private async launch(): Promise<Browser> {
    const executablePath = this.executable()

    this.logger.debug('Launching browser: %s', executablePath)

    // Chromium refuses to start its sandbox as root, which is the default in CI containers
    const args = process.getuid?.() === 0 || process.env.CI ? ['--no-sandbox'] : []
    const browser = await puppeteer.launch({ executablePath, args })

    browser.on('disconnected', () => {
      this.browser = undefined
    })

    return browser
  }
}
