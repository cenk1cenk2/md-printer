import type { PdfConfig } from 'md-to-pdf/dist/lib/config.js'

export interface MdPrinterCtx {
  file: string
  content: string
  template?: string
  templates?: string
  metadata: Record<PropertyKey, any>
  options: Partial<PdfConfig>
}
