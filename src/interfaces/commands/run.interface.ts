import type { TFunction } from 'i18next'
import type { Config as MdToPdfConfig } from 'md-to-pdf/dist/lib/config.js'

export interface MdPrinterI18nOptions {
  language?: string
  fallback?: string
}

export interface MdPrinterOptions extends Partial<MdToPdfConfig> {
  continuous?: boolean
  i18n?: MdPrinterI18nOptions
}

export interface MdPrinterCtx {
  file: string
  content: string
  template?: string
  templates?: string
  metadata: Record<PropertyKey, any>
  renderContinuous?: boolean
  options: MdPrinterOptions
  language?: string
  t?: TFunction
}
