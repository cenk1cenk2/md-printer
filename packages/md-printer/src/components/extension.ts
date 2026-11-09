import { getContext } from 'svelte'

import type { TemplateExtension } from '../interfaces/template.interface.js'

/** The named exports of the extension module of the template, empty without one. */
export function getExtension<T extends TemplateExtension = TemplateExtension>(): T {
  return getContext('md-printer:extension')
}
