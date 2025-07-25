export enum TemplateFiles {
  FOOTER = 'footer.html',
  HEADER = 'header.html',
  TEMPLATE = 'template.html.j2',
  TAILWIND_CSS = 'tailwind.css',
  CSS = 'main.css',
  SETTINGS = 'settings.json'
}

export const RequiredTemplateFiles = [TemplateFiles.SETTINGS]

export const TEMPLATE_DIRECTORY = 'templates'
