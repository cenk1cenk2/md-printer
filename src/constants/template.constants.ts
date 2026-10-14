import type { PDFOptions } from 'puppeteer-core'

export enum TemplateFiles {
  TEMPLATE = 'Template.svelte',
  STYLE = 'style.css',
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

export const TEMPLATE_DIRECTORY = 'templates'

export const COMPONENTS_DIRECTORY = 'components'

export const COMPONENTS_SPECIFIERS = ['@cenk1cenk2/md-printer/components', 'md-printer/components']

export const LEGACY_TEMPLATE_FILES = ['template.html.j2', 'main.css', 'header.html', 'footer.html', 'tailwind.css']

export const RENDER_MODE_CONTEXT = 'md-printer:mode'

export const MARKDOWN_CONTEXT = 'md-printer:markdown'

export const I18N_DIRECTORY = 'i18n'

export const I18N_ACCEPTED_TYPES = ['.yaml', '.yml', '.json']

export const DEFAULT_LANGUAGE = 'en'

export const DEFAULT_TEMPLATE = 'default'

export const DEFAULT_HIGHLIGHT_STYLE = 'github'

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
