import { randomBytes } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import * as mupdf from 'mupdf'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoggerService } from '@cenk1cenk2/oclif-common'
import { AttachmentPosition } from '@constants'
import type { MdPrinterAttachment } from '@interfaces'
import { PdfService } from '@services'

/**
 * A PDF with one page per label, each page printing its label, so the page order of a merge can be read back.
 */
function document(labels: string[], image?: boolean): Buffer {
  const pdf = new mupdf.PDFDocument()
  const fonts = pdf.newDictionary()

  fonts.put('F1', pdf.addSimpleFont(new mupdf.Font('Helvetica')))

  for (const label of labels) {
    const resources = pdf.newDictionary()
    let contents = `BT /F1 24 Tf 72 720 Td (${label}) Tj ET`

    resources.put('Font', fonts)

    if (image) {
      const dictionary = pdf.newDictionary()
      const images = pdf.newDictionary()

      for (const [key, value] of [
        ['Type', pdf.newName('XObject')],
        ['Subtype', pdf.newName('Image')],
        ['ColorSpace', pdf.newName('DeviceRGB')],
        ['Width', 1200],
        ['Height', 1200],
        ['BitsPerComponent', 8]
      ] as const) {
        dictionary.put(key, value)
      }

      // grain on a flat paper tone does not deflate, the same as a scanned certificate
      images.put(
        'Im1',
        pdf.addStream(
          randomBytes(1200 * 1200 * 3).map((value) => 200 + (value % 32)),
          dictionary
        )
      )
      resources.put('XObject', images)
      contents += ' q 400 0 0 400 72 200 cm /Im1 Do Q'
    }

    pdf.insertPage(-1, pdf.addPage([0, 0, 595, 842], 0, resources, contents))
  }

  return Buffer.from(pdf.saveToBuffer('compress').asUint8Array())
}

function labels(pdf: Buffer): string[] {
  const parsed = new mupdf.PDFDocument(pdf)

  return Array.from({ length: parsed.countPages() }, (_, page) => parsed.loadPage(page).toStructuredText('').asText().trim())
}

describe('PdfService', () => {
  const service = new PdfService({ setup: (): void => undefined, debug: (): void => undefined } as unknown as LoggerService)
  const rendered = document(['doc-1', 'doc-2', 'doc-3'])
  let directory: string

  const process = (attachments: MdPrinterAttachment[], compress = false): ReturnType<PdfService['process']> =>
    service.process(rendered, {
      directory,
      attachments,
      compress
    })

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-pdf-'))

    await writeFile(join(directory, 'one.pdf'), document(['one-1']))
    await writeFile(join(directory, 'two.pdf'), document(['two-1', 'two-2']))
    await writeFile(join(directory, 'scan.pdf'), document(['scan-1'], true))
    await writeFile(join(directory, 'note.txt'), 'not a pdf')
  })

  afterAll(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it('returns the rendered PDF unchanged without attachments and compression', async() => {
    expect((await process([])).pdf).toBe(rendered)
  })

  it('places attachments before the document', async() => {
    expect(labels((await process([{ file: 'two.pdf', position: AttachmentPosition.BEFORE }])).pdf)).toEqual(['two-1', 'two-2', 'doc-1', 'doc-2', 'doc-3'])
  })

  it('places attachments after the document, also when no position is given', async() => {
    const { pdf } = await process([{ file: 'one.pdf', position: AttachmentPosition.AFTER }, { file: 'two.pdf' }])

    expect(labels(pdf)).toEqual(['doc-1', 'doc-2', 'doc-3', 'one-1', 'two-1', 'two-2'])
  })

  it('places an attachment at an exact page of the rendered document', async() => {
    expect(labels((await process([{ file: 'two.pdf', position: 2 }])).pdf)).toEqual(['doc-1', 'two-1', 'two-2', 'doc-2', 'doc-3'])
  })

  it('counts exact pages against the rendered document when several attachments are placed', async() => {
    expect(
      labels(
        (
          await process([
            { file: 'one.pdf', position: 3 },
            { file: 'two.pdf', position: AttachmentPosition.BEFORE },
            { file: 'scan.pdf', position: 2 },
            { file: 'one.pdf', position: 2 }
          ])
        ).pdf
      )
    ).toEqual(['two-1', 'two-2', 'doc-1', 'scan-1', 'one-1', 'doc-2', 'one-1', 'doc-3'])
  })

  it('accepts the page after the last one, which appends', async() => {
    expect(labels((await process([{ file: 'one.pdf', position: 4 }])).pdf)).toEqual(['doc-1', 'doc-2', 'doc-3', 'one-1'])
  })

  it('rejects a page past the end of the document', async() => {
    await expect(process([{ file: 'one.pdf', position: 5 }])).rejects.toThrow('placed at page 5, but the document has 3 pages')
  })

  it('returns the attachment paths, so a preview session watches them', async() => {
    expect((await process([{ file: 'one.pdf' }])).assets).toEqual([join(directory, 'one.pdf')])
  })

  it('rejects attachments that are not PDFs or outside the input directory', async() => {
    await expect(process([{ file: 'note.txt' }])).rejects.toThrow('Attachment is not a PDF: note.txt')
    await expect(process([{ file: '../outside.pdf' }])).rejects.toThrow('outside of the input directory')
  })

  it('keeps an attachment as it is without compression', async() => {
    const plain = (await process([{ file: 'scan.pdf', compress: false }])).pdf
    const compressed = (await process([{ file: 'scan.pdf', compress: true }])).pdf

    expect(plain.length).toBeGreaterThan(1_000_000)
    expect(compressed.length).toBeLessThan(plain.length / 2)
    expect(labels(compressed)).toEqual(['doc-1', 'doc-2', 'doc-3', 'scan-1'])
  })

  it('compresses only the attachments that ask for it', async() => {
    const both = (
      await process([
        { file: 'scan.pdf', compress: true },
        { file: 'scan.pdf', compress: true }
      ])
    ).pdf
    const one = (await process([{ file: 'scan.pdf', compress: true }, { file: 'scan.pdf' }])).pdf

    expect(one.length).toBeGreaterThan(both.length + 1_000_000)
  })

  it('compresses the whole document, attachments included', async() => {
    const scanned = document(['doc-1'], true)
    const plain = (
      await service.process(scanned, {
        directory,
        attachments: [{ file: 'scan.pdf' }],
        compress: false
      })
    ).pdf
    const compressed = (
      await service.process(scanned, {
        directory,
        attachments: [{ file: 'scan.pdf' }],
        compress: true
      })
    ).pdf

    expect(plain.length).toBeGreaterThan(4_000_000)
    expect(compressed.length).toBeLessThan(plain.length / 2)
    expect(labels(compressed)).toEqual(['doc-1', 'scan-1'])
  })
})
