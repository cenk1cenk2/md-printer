import { Module } from '@nestjs/common'

import { I18nService } from './i18n.service.js'
import { MarkdownService } from './markdown.service.js'
import { PrinterService } from './printer.service.js'
import { BrowserService } from './renderer/browser.service.js'
import { RendererService } from './renderer/renderer.service.js'
import { PreviewService } from './session/preview.service.js'
import { SessionService } from './session/session.service.js'
import { ATrustAdapter } from './signature/adapters/a-trust.adapter.js'
import { SignatureService } from './signature/signature.service.js'
import { TemplateService } from './template/template.service.js'

const providers = [I18nService, MarkdownService, TemplateService, BrowserService, RendererService, ATrustAdapter, SignatureService, PrinterService, SessionService, PreviewService]

@Module({
  providers,
  exports: providers
})
export class PrinterModule {}
