import type { TFunction } from 'i18next'

import type { MdPrinterSignature } from './signature.interface.js'

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

export interface DocumentShellProps {
  lang: string
  title?: string
  head: string
  body: string
}

export interface MarginShellProps {
  styles: string
  body: string
}

export interface TemplateEntry {
  part: (props: TemplateProps, context: [string, unknown][]) => Promise<RenderedPart>
  document: (props: DocumentShellProps) => string
  margin: (props: MarginShellProps) => string
}

export interface TemplateStylesheet {
  file: string
  source: string
}

export interface TemplateBundle {
  entry: TemplateEntry
  modules: string[]
  stylesheets: TemplateStylesheet[]
}

export interface TemplateRenderOptions {
  language: string
  title?: string
  fallbackTitle?: string
  highlight: string
}

export interface SveltePluginOptions {
  template: string
  components: string
  root: string
  stylesheets: TemplateStylesheet[]
}

export interface RenderedDocument {
  title?: string
  html: string
  header?: string
  footer?: string
  dependencies: string[]
}
