import type { X509Certificate } from 'crypto'
import type { PDFOptions } from 'puppeteer-core'

import type { MdPrinterSignature, MdPrinterSignOptions } from '../signature.interface.js'
import type { MediaType, OutputFileType } from '@constants'

export interface MdPrinterI18nOptions {
  language?: string
  fallback?: string
}

export interface I18nLoadOptions extends MdPrinterI18nOptions {
  language: string
}

export interface MdPrinterSettings {
  pdfOptions?: PDFOptions
  i18n?: MdPrinterI18nOptions
  sign?: MdPrinterSignOptions
  continuous?: boolean
  media?: MediaType
  highlightStyle?: string
}

export interface MdPrinterOptions {
  template: string
  output: OutputFileType
  dest?: string
  title?: string
  language: string
  continuous: boolean
  media: MediaType
  highlight: string
  pdf: PDFOptions
  i18n: MdPrinterI18nOptions
  sign: MdPrinterSignOptions
}

export interface MdPrinterFlags {
  file?: string
  output?: string
  stdin?: string
  inputFiletype?: string
  outputFiletype?: string
  stdout?: boolean
  template?: string
  title?: string
  language?: string
  continuous?: boolean
  sign?: boolean
  signProvider?: string
  signCertificate?: string
}

export interface MdPrinterInput {
  file?: string
  directory: string
  content: string
  data: Record<string, any>
}

export interface MdPrinterCtx {
  input: MdPrinterInput
  options: MdPrinterOptions
  signingTime?: Date
  certificate?: X509Certificate
  signature?: MdPrinterSignature
}
