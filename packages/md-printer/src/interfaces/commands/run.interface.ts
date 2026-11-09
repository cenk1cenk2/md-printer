import type { X509Certificate } from 'crypto'
import type { Root } from 'hast'
import type { PDFOptions } from 'puppeteer-core'

import type { MdPrinterAttachment } from '../attachment.interface.js'
import type { MdPrinterSignature, MdPrinterSignOptions } from '../signature.interface.js'
import type { TemplatePaths } from '../template.interface.js'
import type { InputFileType, MediaType, OutputFileType, SignatureProvider } from '@constants'

export interface MdPrinterI18nOptions {
  language?: string
  fallback?: string
}

export interface I18nLoadOptions extends MdPrinterI18nOptions {
  language: string
}

export interface MdPrinterTemplateFiles {
  template?: string
  /** One folder or several, a component of a later folder replaces one of the same name in an earlier folder. */
  components?: string | string[]
  /** One module or several, an export of a later module replaces one of the same name in an earlier module. */
  extension?: string | string[]
  /** One folder or several, a key of a later folder replaces the same key of an earlier folder. */
  i18n?: string | string[]
}

export interface MdPrinterSettings {
  files?: MdPrinterTemplateFiles
  pdfOptions?: PDFOptions
  i18n?: MdPrinterI18nOptions
  sign?: MdPrinterSignOptions
  continuous?: boolean
  media?: MediaType
  highlightStyle?: string
}

export interface MdPrinterOptions {
  template: string
  files: TemplatePaths
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
  attachments: MdPrinterAttachment[]
  compress: boolean
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
  templateType?: string
  templateDirectory?: string
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
