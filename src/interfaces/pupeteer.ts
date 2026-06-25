import type * as Puppeteer from 'puppeteer'
import type { PDFOptions } from 'puppeteer'

export type ParsedPdfOptions = PDFOptions & {
  height: number
  margin: { bottom: number; left: number; right: number; top: number }
  width: number
}

export type PuppeteerPdfHelpers = typeof Puppeteer & {
  parsePDFOptions: (options?: PDFOptions, lengthUnit?: 'cm' | 'in') => ParsedPdfOptions
  unitToPixels: { cm: number }
}
