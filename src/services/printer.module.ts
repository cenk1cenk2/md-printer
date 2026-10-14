import type { DynamicModule } from '@nestjs/common'
import { Module } from '@nestjs/common'

import { I18nService } from './i18n.service.js'
import { MarkdownService } from './markdown.service.js'
import { PrinterService } from './printer.service.js'
import { ProcessService } from './process.service.js'
import { BrowserService } from './renderer/browser.service.js'
import { RendererService } from './renderer/renderer.service.js'
import { PreviewService } from './session/preview.service.js'
import { SessionService } from './session/session.service.js'
import { ATrustAdapter } from './signature/adapters/a-trust.adapter.js'
import { SignatureService } from './signature/signature.service.js'
import { TemplateService } from './template/template.service.js'
import { PRINTER_MODULE_OPTIONS } from '@constants'
import type { PrinterModuleOptions } from '@interfaces'

@Module({})
export class PrinterModule {
  public static forRoot(options: PrinterModuleOptions): DynamicModule {
    return {
      module: PrinterModule,
      providers: [
        { provide: PRINTER_MODULE_OPTIONS, useValue: options },
        I18nService,
        MarkdownService,
        TemplateService,
        BrowserService,
        RendererService,
        ATrustAdapter,
        SignatureService,
        PrinterService,
        ProcessService,
        SessionService,
        PreviewService
      ]
    }
  }
}
