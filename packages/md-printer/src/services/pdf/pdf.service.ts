import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import * as mupdf from 'mupdf'
import { resolve } from 'path'

import { resolveConfined } from '../template/assets.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import { AttachmentPosition } from '@constants'
import type { MdPrinterAttachment, PdfProcessOptions, PdfProcessResult } from '@interfaces'

interface LoadedAttachment {
  attachment: MdPrinterAttachment
  document: mupdf.PDFDocument
  anchor: number
}

/**
 * Merges attachments into the rendered PDF and compresses images, before the document is signed.
 */
@Injectable()
export class PdfService {
  private static readonly IMAGE_MAX_DIMENSION = 2000
  private static readonly JPEG_QUALITY = 75

  constructor(private readonly logger: LoggerService) {
    this.logger.setup(this.constructor.name)
  }

  public async process(pdf: Buffer, options: PdfProcessOptions): Promise<PdfProcessResult> {
    if (!options.attachments.length && !options.compress) {
      return { pdf, assets: [] }
    }

    const document = new mupdf.PDFDocument(pdf)
    const pages = document.countPages()
    const assets: string[] = []
    const loaded = await Promise.all(
      options.attachments.map(async(attachment): Promise<LoadedAttachment> => {
        const { content, path } = await this.load(attachment.file, options.directory)

        if (path) {
          assets.push(path)
        }

        return {
          attachment,
          document: this.open(attachment.file, content),
          anchor: this.anchor(attachment, pages)
        }
      })
    )

    // inserted from the last anchor to the first, so the anchors still point at the pages of the rendered document;
    // attachments sharing an anchor are inserted in reverse, which keeps them in the order they are listed
    for (const { attachment, document: source, anchor } of loaded.map((item, index) => ({ ...item, index })).sort((a, b) => b.anchor - a.anchor || b.index - a.index)) {
      if (attachment.compress && !options.compress) {
        this.compress(source)
      }

      for (let page = 0; page < source.countPages(); page++) {
        document.graftPage(anchor + page, source, page)
      }

      this.logger.debug('Attached %s with %d pages at page %d.', attachment.file, source.countPages(), anchor + 1)
    }

    if (options.compress) {
      this.compress(document)
    }

    const output = Buffer.from(document.saveToBuffer(options.compress ? 'garbage=compact,compress,compress-fonts' : 'garbage=compact,compress').asUint8Array())

    this.logger.debug('Processed PDF: %d bytes to %d bytes.', pdf.length, output.length)

    return { pdf: output, assets }
  }

  private anchor(attachment: MdPrinterAttachment, pages: number): number {
    if (attachment.position === AttachmentPosition.BEFORE) {
      return 0
    }

    if (typeof attachment.position !== 'number') {
      return pages
    }

    if (attachment.position > pages + 1) {
      throw new Error(`Attachment ${attachment.file} is placed at page ${attachment.position}, but the document has ${pages} pages.`)
    }

    return attachment.position - 1
  }

  private async load(file: string, directory: string): Promise<{ content: Uint8Array; path?: string }> {
    if (/^https?:\/\//.test(file)) {
      const response = await fetch(file)

      if (!response.ok) {
        throw new Error(`Attachment can not be fetched: ${file}, ${response.status} ${response.statusText}`)
      }

      return { content: new Uint8Array(await response.arrayBuffer()) }
    }

    const path = await resolveConfined(resolve(directory, file), directory)

    if (!path) {
      throw new Error(`Attachment does not exist or is outside of the input directory: ${file}`)
    }

    return { content: await readFile(path), path }
  }

  private open(file: string, content: Uint8Array): mupdf.PDFDocument {
    if (Buffer.from(content.subarray(0, 5)).toString() !== '%PDF-') {
      throw new Error(`Attachment is not a PDF: ${file}`)
    }

    return new mupdf.PDFDocument(content)
  }

  /**
   * Re-encodes the images of a document as JPEG, scaled down to fit a printed page, whenever that makes them smaller.
   * Soft masks, stencil masks and images below 8 bits per component keep their lossless encoding.
   */
  private compress(document: mupdf.PDFDocument): void {
    const images: mupdf.PDFObject[] = []
    const masks = new Set<number>()

    for (let number = 1; number < document.countObjects(); number++) {
      const object = document.newIndirect(number)

      if (!object.isStream()) {
        continue
      }

      const subtype = object.get('Subtype')

      if (!subtype.isName() || subtype.asName() !== 'Image') {
        continue
      }

      const mask = object.get('SMask')

      if (mask.isIndirect()) {
        masks.add(mask.asIndirect())
      }

      images.push(object)
    }

    for (const object of images) {
      if (masks.has(object.asIndirect()) || object.get('ImageMask').valueOf() === true) {
        continue
      }

      const image = document.loadImage(object)

      if (image.getBitsPerComponent() < 8) {
        continue
      }

      let pixmap = image.toPixmap()

      if (pixmap.getAlpha()) {
        continue
      }

      if (!pixmap.getColorSpace().isGray() && !pixmap.getColorSpace().isRGB()) {
        pixmap = pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB)
      }

      const [width, height] = [pixmap.getWidth(), pixmap.getHeight()]
      const scale = Math.min(1, PdfService.IMAGE_MAX_DIMENSION / Math.max(width, height))

      if (scale < 1) {
        pixmap = pixmap.warp(
          [
            [0, 0],
            [width, 0],
            [width, height],
            [0, height]
          ],
          Math.round(width * scale),
          Math.round(height * scale)
        )
      }

      const jpeg = pixmap.asJPEG(PdfService.JPEG_QUALITY)

      if (jpeg.length >= object.readRawStream().length) {
        continue
      }

      object.writeRawStream(jpeg)
      object.put('Filter', document.newName('DCTDecode'))
      object.delete('DecodeParms')
      object.delete('Decode')
      object.put('Width', pixmap.getWidth())
      object.put('Height', pixmap.getHeight())
      object.put('BitsPerComponent', 8)
      object.put('ColorSpace', document.newName(pixmap.getColorSpace().isGray() ? 'DeviceGray' : 'DeviceRGB'))
    }
  }
}
