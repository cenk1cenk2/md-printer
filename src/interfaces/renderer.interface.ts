import type { PDFOptions } from 'puppeteer-core'

import type { MediaType } from '@constants'

export interface PrinterModuleOptions {
  browser?: string
}

export interface RendererOptions {
  directory: string
  pdf: PDFOptions
  media: MediaType
  continuous: boolean
}

export interface RendererResult {
  pdf: Buffer
  assets: string[]
}
