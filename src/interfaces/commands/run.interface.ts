import type { X509Certificate } from 'crypto'
import type { Root } from 'hast'
import type { PDFOptions } from 'puppeteer-core'

import type { MdPrinterSignature, MdPrinterSignOptions } from '../signature.interface.js'
import type { InputFileType, MediaType, OutputFileType, SignatureProvider } from '@constants'

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

interface MdPrinterFileSource {
  file: string
  stdin?: never
}

interface MdPrinterStdinSource {
  file?: never
  stdin: string
}

export type MdPrinterFlags = (MdPrinterFileSource | MdPrinterStdinSource) & MdPrinterFlagOptions

export interface MdPrinterFlagOptions {
  output?: string
  inputFiletype?: InputFileType
  outputFiletype?: OutputFileType
  stdout?: boolean
  template?: string
  title?: string
  language?: string
  continuous?: boolean
  sign?: boolean
  signProvider?: SignatureProvider
  signCertificate?: string
}

export interface MdPrinterInput {
  file?: string
  directory: string
  markdown: Root
  data: Record<string, any>
}

export interface MdPrinterCtx {
  input: MdPrinterInput
  options: MdPrinterOptions
  signingTime?: Date
  certificate?: X509Certificate
  signature?: MdPrinterSignature
}
