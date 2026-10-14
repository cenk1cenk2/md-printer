import type { PDFOptions } from 'puppeteer-core'

export enum TemplateFiles {
  TEMPLATE = 'Template.svelte',
  SETTINGS = 'settings.json'
}

export enum RenderMode {
  BODY = 'body',
  HEADER = 'header',
  FOOTER = 'footer'
}

export enum MediaType {
  SCREEN = 'screen',
  PRINT = 'print'
}

export enum Directory {
  TEMPLATES = 'templates',
  COMPONENTS = 'components',
  I18N = 'i18n'
}

export enum ModuleSpecifier {
  TEMPLATE = 'md-printer:template',
  COMPONENTS = '@cenk1cenk2/md-printer/components',
  TEMPLATE_COMPONENTS = 'md-printer:template-components'
}

export enum ContextKey {
  RENDER_MODE = 'md-printer:mode',
  DOCUMENT = 'md-printer:document',
  MARKDOWN = 'md-printer:markdown',
  COMPONENTS = 'md-printer:components'
}

export const TAILWIND_STYLE_LANG = 'postcss'

export const PAGE_BREAK_CLASS = 'page-break'

export const DIRECTIVE_TAG = 'md-printer-directive'

export const PRINTER_MODULE_OPTIONS = Symbol('md-printer:options')

export const I18N_ACCEPTED_TYPES = ['.yaml', '.yml', '.json']

export const DEFAULT_LANGUAGE = 'en'

export const DEFAULT_TEMPLATE = 'default'

export const DEFAULT_HIGHLIGHT_STYLE = 'atom-one-dark'

export const DEFAULT_PDF_OPTIONS: PDFOptions = {
  format: 'A4',
  printBackground: true,
  margin: {
    top: '30mm',
    right: '40mm',
    bottom: '30mm',
    left: '20mm'
  }
}
