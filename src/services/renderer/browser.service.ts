import type { OnModuleDestroy } from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import type { Browser } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

import { discoverBrowser } from './browser.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { PRINTER_MODULE_OPTIONS } from '@constants'
import type { PrinterModuleOptions } from '@interfaces'

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser?: Promise<Browser>

  constructor(
    private readonly logger: LoggerService,
    @Inject(PRINTER_MODULE_OPTIONS) private readonly options: PrinterModuleOptions
  ) {
    this.logger.setup(this.constructor.name)
  }

  public executable(): string {
    return discoverBrowser(this.options.browser, process.env)
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

    const browser = await puppeteer.launch({
      executablePath,
      // puppeteer's own handlers exit the process right away, which skips closing the session, the preview server and the profile
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      // Chromium refuses to start its sandbox as root, which is the default in CI containers
      args: process.getuid?.() === 0 || process.env.CI ? ['--no-sandbox'] : []
    })

    browser.on('disconnected', () => {
      this.browser = undefined
    })

    return browser
  }
}
