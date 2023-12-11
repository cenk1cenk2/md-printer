import type { GrayMatterFile } from 'gray-matter'
import type { PdfConfig } from 'md-to-pdf/dist/lib/config.js'

export interface MdPrinterCtx {
  file: string
  content: string
  template?: string
  templates?: string
  graymatter: GrayMatterFile<string>
  options: Partial<PdfConfig>
}
