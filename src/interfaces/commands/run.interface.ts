import type { Config as MdToPdfConfig } from 'md-to-pdf/dist/lib/config.js'

export interface MdPrinterOptions extends Partial<MdToPdfConfig> {
  continuous?: boolean
}

export interface MdPrinterCtx {
  file: string
  content: string
  template?: string
  templates?: string
  metadata: Record<PropertyKey, any>
  renderContinuous?: boolean
  options: MdPrinterOptions
}
