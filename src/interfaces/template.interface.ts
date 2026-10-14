import type { TFunction } from 'i18next'

import type { MdPrinterSignature } from './signature.interface.js'
import type { RenderMode } from '@constants'

export interface TemplateProps {
  data: Record<string, any>
  content: string
  t: TFunction
  language: string
  signature?: MdPrinterSignature
}

export interface TemplateContext {
  markdown: (markdown: string) => string
}

export interface RenderedPart {
  head: string
  body: string
}

export interface TemplateBundle {
  render: (props: TemplateProps, mode: RenderMode, context: TemplateContext) => Promise<RenderedPart>
  modules: string[]
}

export interface RenderedDocument {
  title?: string
  html: string
  header?: string
  footer?: string
  dependencies: string[]
}
