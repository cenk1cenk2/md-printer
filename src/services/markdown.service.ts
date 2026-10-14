import { Injectable } from '@nestjs/common'
import { all } from 'lowlight'
import type { Root } from 'mdast'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import { matter } from 'vfile-matter'

import { PAGE_BREAK_CLASS } from '@constants'
import type { MarkdownDocument } from '@interfaces'

@Injectable()
export class MarkdownService {
  private readonly processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(() => (tree: Root, file: VFile): void => {
      visit(tree, ['containerDirective', 'leafDirective', 'textDirective'], (node, index, parent) => {
        if (node.type === 'leafDirective' && node.name === 'pagebreak') {
          node.data = { hName: 'div', hProperties: { className: [PAGE_BREAK_CLASS] } }

          return
        }

        // only ::pagebreak is a directive, anything else that parses as one, such as "10:30am" or "note:here", stays the text it was written as
        const text = { type: 'text', value: String(file.value).slice(node.position.start.offset, node.position.end.offset) } as const

        parent.children.splice(index, 1, node.type === 'textDirective' ? text : { type: 'paragraph', children: [text] })

        return SKIP
      })
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeHighlight, { languages: all })
    .use(rehypeStringify)
    .freeze()

  public parse(source: string): MarkdownDocument {
    const file = new VFile(source)

    matter(file)

    return {
      content: String(this.processor.processSync(file)),
      data: (file.data.matter as Record<string, any>) ?? {}
    }
  }
}
