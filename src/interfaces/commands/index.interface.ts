import type { PdfConfig } from 'md-to-pdf/dist/lib/config'

export interface MdPrinterCtx {
  file: string
  content: string
  options: Partial<PdfConfig>
}
