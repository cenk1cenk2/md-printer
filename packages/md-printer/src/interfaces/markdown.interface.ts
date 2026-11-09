import type { Root } from 'hast'

export interface MarkdownDocument {
  markdown: Root
  data: Record<string, any>
}

export type MarkdownNode = MarkdownHtmlNode | MarkdownElementNode | MarkdownComponentNode

export interface MarkdownHtmlNode {
  type: 'html'
  html: string
}

export interface MarkdownElementNode {
  type: 'element'
  tag: string
  attributes: Record<string, string | true>
  children: MarkdownNode[]
}

export interface MarkdownComponentNode {
  type: 'component'
  name: string
  props: Record<string, string>
  children: MarkdownNode[]
}
