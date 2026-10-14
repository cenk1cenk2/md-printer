import Template from 'md-printer:template'
import { render } from 'svelte/server'

import Document from './Document.svelte'
import Margin from './Margin.svelte'
import type { DocumentShellProps, MarginShellProps, RenderedPart, TemplateProps } from '@interfaces'

/**
 * Entry of every template bundle, compiled at runtime together with the template it renders.
 */
export function part(props: TemplateProps, context: [string, unknown][]): Promise<RenderedPart> {
  return Promise.resolve(render(Template, { props, context: new Map(context) }))
}

export function document(props: DocumentShellProps): string {
  return `<!doctype html>${render(Document, { props }).body}`
}

export function margin(props: MarginShellProps): string {
  return render(Margin, { props }).body
}
