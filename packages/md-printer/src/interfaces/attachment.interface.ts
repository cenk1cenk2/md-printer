import type { AttachmentPosition } from '@constants'

export interface MdPrinterAttachment {
  file: string
  position?: AttachmentPosition | number
  compress?: boolean
}

export interface PdfProcessOptions {
  directory: string
  attachments: MdPrinterAttachment[]
  compress: boolean
}

export interface PdfProcessResult {
  pdf: Buffer
  assets: string[]
}
