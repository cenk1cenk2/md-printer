import type { TFunction } from 'i18next'
import type { Component } from 'svelte'

import type { MdPrinterSettings } from './commands/run.interface.js'
import type { MarkdownNode } from './markdown.interface.js'
import type { MdPrinterSignature } from './signature.interface.js'

export interface DocumentContext {
  data: Record<string, any>
  t: TFunction
  language: string
  signature?: MdPrinterSignature
}

/** The named exports of the extension modules of a template, empty without one. */
export type TemplateExtension = Record<string, any>

export interface TemplateProps extends DocumentContext {
  content: string
  extension: TemplateExtension
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
  extension: TemplateExtension
  part: (props: TemplateProps, context: [string, unknown][]) => Promise<RenderedPart>
  content: (nodes: MarkdownNode[], context: [string, unknown][]) => string
  document: (props: DocumentShellProps) => string
  margin: (props: MarginShellProps) => string
}

export interface TemplateStylesheet {
  file: string
  source: string
}

/** The absolute paths of a template, with the defaults of its layout filled in. */
export interface TemplatePaths {
  directory: string
  template: string
  /** In order, a later folder winning on a name both have. */
  components: string[]
  /** In order, a later folder winning on a key both have. */
  i18n: string[]
  /** The extension modules in order, empty without one. */
  extension: string[]
  /** Every path that decides the others, so a preview notices when one appears. */
  candidates: string[]
}

export interface ResolvedTemplate {
  directory: string
  settings: MdPrinterSettings
  files: TemplatePaths
}

export interface TemplateBundle {
  template: string
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
  templateComponents?: string[]
  root: string
  stylesheets: TemplateStylesheet[]
  extension?: string[]
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
