import type { TFunction } from 'i18next'
import type { Component } from 'svelte'

import type { MarkdownNode } from './markdown.interface.js'
import type { MdPrinterSignature } from './signature.interface.js'

export interface DocumentContext {
  data: Record<string, any>
  t: TFunction
  language: string
  signature?: MdPrinterSignature
}

export interface TemplateProps extends DocumentContext {
  content: string
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
  components: Record<string, Component<any>>
  part: (props: TemplateProps, context: [string, unknown][]) => Promise<RenderedPart>
  content: (nodes: MarkdownNode[], context: [string, unknown][]) => string
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
  directives: Map<string, string>
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
  html: string
  header?: string
  footer?: string
  dependencies: string[]
}

export interface InlinedAsset {
  uri: string
  path?: string
}

export type AssetInliner = (reference: string) => Promise<string | undefined>

export type AssetCache = Map<string, Promise<InlinedAsset | undefined>>

export interface InlineAssetsOptions {
  remote?: boolean
  confined?: boolean
  cache?: AssetCache
}

export interface InlinedAssets {
  content: string
  assets: string[]
}

export interface CompiledModule {
  module: any
  modules: string[]
}
