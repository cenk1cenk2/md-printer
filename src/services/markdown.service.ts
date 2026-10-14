import { Injectable } from '@nestjs/common'
import type { Element, ElementContent, Properties, Root, RootContent, Text } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { all } from 'lowlight'
import type { Root as MdastRoot } from 'mdast'
import { find, html } from 'property-information'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { EXIT, SKIP, visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import { matter } from 'vfile-matter'

import { DIRECTIVE_TAG, PAGE_BREAK_CLASS } from '@constants'
import type { MarkdownDocument, MarkdownNode } from '@interfaces'

/**
 * Markdown is parsed before the template is known, so directives stay placeholder elements until {@link MarkdownService.resolve} gets the
 * template's components.
 */
@Injectable()
export class MarkdownService {
  private readonly processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(() => (tree: MdastRoot, file: VFile): void => {
      visit(tree, ['containerDirective', 'leafDirective', 'textDirective'] as const, (node) => {
        if (node.type === 'leafDirective' && node.name === 'pagebreak') {
          node.data = { hName: 'div', hProperties: { className: [PAGE_BREAK_CLASS] } }

          return
        }

        node.data = {
          hName: DIRECTIVE_TAG,
          hProperties: {
            dataType: node.type,
            dataName: node.name,
            dataAttributes: JSON.stringify(Object.fromEntries(Object.entries(node.attributes ?? {}).map(([key, value]) => [key, value ?? '']))),
            dataSource: String(file.value).slice(node.position.start.offset, node.position.end.offset)
          }
        }
      })
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight, { languages: all })
    .freeze()

  public parse(source: string): MarkdownDocument {
    const file = new VFile(source)

    matter(file)

    return {
      markdown: this.processor.runSync(this.processor.parse(file), file),
      data: (file.data.matter as Record<string, any>) ?? {}
    }
  }

  /**
   * Splits the document into HTML and the elements on the way to a component, so only directives render as components.
   */
  public resolve(tree: Root, directives: Map<string, string>): MarkdownNode[] {
    const resolved = unified()
      .use<[], Root>(() => (root: Root): void => {
        visit(root, { type: 'element', tagName: DIRECTIVE_TAG }, (node: Element, index, parent) => {
          if (directives.has(String(node.properties.dataName))) {
            return
          }

          // a directive without a component, such as "10:30am" or "note:here", stays the text it was written as
          const text: Text = { type: 'text', value: String(node.properties.dataSource) }

          parent.children[index] =
            node.properties.dataType === 'textDirective'
              ? text
              : {
                type: 'element',
                tagName: 'p',
                properties: {},
                children: [text]
              }

          return SKIP
        })
      })
      // after the restore, since restored text is part of a heading's slug
      .use(rehypeSlug)
      .runSync(structuredClone(tree))

    return this.nodes(resolved.children, directives)
  }

  private nodes(children: (RootContent | ElementContent)[], directives: Map<string, string>): MarkdownNode[] {
    return children.reduce<MarkdownNode[]>((nodes, child) => {
      const node = this.node(child, directives)
      const last = nodes.at(-1)

      if (node.type === 'html' && last?.type === 'html') {
        last.html += node.html
      } else {
        nodes.push(node)
      }

      return nodes
    }, [])
  }

  private node(child: RootContent | ElementContent, directives: Map<string, string>): MarkdownNode {
    let directive = false

    visit(child, { type: 'element', tagName: DIRECTIVE_TAG }, () => {
      directive = true

      return EXIT
    })

    if (child.type !== 'element' || !directive) {
      return { type: 'html', html: toHtml(child) }
    }

    if (child.tagName === DIRECTIVE_TAG) {
      return {
        type: 'component',
        name: directives.get(String(child.properties.dataName)),
        props: JSON.parse(String(child.properties.dataAttributes)),
        children: this.nodes(child.children, directives)
      }
    }

    return {
      type: 'element',
      tag: child.tagName,
      attributes: this.attributes(child.properties),
      children: this.nodes(child.children, directives)
    }
  }

  private attributes(properties: Properties): Record<string, string | true> {
    return Object.fromEntries(
      Object.entries(properties).flatMap(([key, value]) => {
        if (value === null || value === undefined || value === false) {
          return []
        }

        const { attribute, commaSeparated } = find(html, key)

        return [[attribute, value === true ? true : Array.isArray(value) ? value.join(commaSeparated ? ', ' : ' ') : String(value)]]
      })
    )
  }
}
