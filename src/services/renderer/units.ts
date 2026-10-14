import type { PaperFormat, PDFOptions } from 'puppeteer-core'

export interface PixelBox {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
}

const PIXELS_PER_UNIT: Record<string, number> = {
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72
}

// paper sizes in inches, matching Chrome's print sizes
const PAPER_FORMATS: Record<Lowercase<PaperFormat>, [number, number]> = {
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
  ledger: [17, 11],
  a0: [33.1102, 46.811],
  a1: [23.3858, 33.1102],
  a2: [16.5354, 23.3858],
  a3: [11.6929, 16.5354],
  a4: [8.2677, 11.6929],
  a5: [5.8268, 8.2677],
  a6: [4.1339, 5.8268]
}

export function toPixels(value: string | number | undefined): number {
  if (value === undefined || value === '') {
    return 0
  }

  if (typeof value === 'number') {
    return value
  }

  const match = value.trim().match(/^(-?[\d.]+)\s*(px|in|cm|mm|pt)?$/i)

  if (!match) {
    throw new Error(`Can not parse length: ${value}`)
  }

  return Number(match[1]) * PIXELS_PER_UNIT[(match[2] ?? 'px').toLowerCase()]
}

/**
 * Parses CSS-style one to four value margins ("18mm 12mm") or a margin object.
 */
export function margins(margin: PDFOptions['margin'] | string | undefined): PixelBox['margin'] {
  if (typeof margin === 'string') {
    const values = margin.trim().split(/\s+/).map(toPixels)
    const [top, right = top, bottom = top, left = right] = values

    return {
      top,
      right,
      bottom,
      left
    }
  }

  return {
    top: toPixels(margin?.top),
    right: toPixels(margin?.right),
    bottom: toPixels(margin?.bottom),
    left: toPixels(margin?.left)
  }
}

/**
 * Puppeteer only accepts margin objects, settings and front-matter may use the CSS shorthand.
 */
export function normalizeMargin(margin: PDFOptions['margin'] | string | undefined): PDFOptions['margin'] {
  if (typeof margin !== 'string') {
    return margin
  }

  const [top, right = top, bottom = top, left = right] = margin.trim().split(/\s+/)

  return {
    top,
    right,
    bottom,
    left
  }
}

export function pixels(options: PDFOptions): PixelBox {
  let width = toPixels(options.width)
  let height = toPixels(options.height)

  if (options.format || (!width && !height)) {
    const [inchWidth, inchHeight] = PAPER_FORMATS[(options.format ?? 'A4').toLowerCase() as Lowercase<PaperFormat>] ?? PAPER_FORMATS.a4

    width = inchWidth * 96
    height = inchHeight * 96
  }

  if (options.landscape) {
    ;[width, height] = [height, width]
  }

  return {
    width,
    height,
    margin: margins(options.margin)
  }
}
