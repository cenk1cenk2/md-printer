import type { MdPrinterCtx } from './commands/run.interface.js'
import type { RenderedDocument } from './template.interface.js'

export interface SessionBuild {
  version: number
  ms: number
  ctx: MdPrinterCtx
  document: RenderedDocument
  output: Buffer
}

export interface SessionEvents {
  building: []
  ready: [SessionBuild]
  failed: [Error]
}

export interface PreviewOptions {
  host: string
  port: number
}

export interface PreviewError {
  message: string
  frame?: string
  file?: string
}
