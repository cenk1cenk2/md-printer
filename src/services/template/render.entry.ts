import Template from 'md-printer:template'
import components from 'md-printer:template-components'
import { render } from 'svelte/server'

import Document from './Document.svelte'
import Margin from './Margin.svelte'
import Nodes from '../../components/Nodes.svelte'
import type { DocumentShellProps, MarginShellProps, MarkdownNode, RenderedPart, TemplateProps } from '@interfaces'

export { components }

/**
 * Entry of every template bundle, compiled at runtime together with the template it renders.
 */
export function part(props: TemplateProps, context: [string, unknown][]): Promise<RenderedPart> {
  return Promise.resolve(render(Template, { props, context: new Map(context) }))
}

/**
 * The markdown as one HTML string, for templates that place it with `{@html content}`. Plain HTML is kept as is, without Svelte's hydration markers.
 */
export function content(nodes: MarkdownNode[], context: [string, unknown][]): string {
  return nodes.map((node) => (node.type === 'html' ? node.html : render(Nodes, { props: { nodes: [node] }, context: new Map(context) }).body)).join('')
}

export function document(props: DocumentShellProps): string {
  return `<!doctype html>${render(Document, { props }).body}`
}

export function margin(props: MarginShellProps): string {
  return render(Margin, { props }).body
}
