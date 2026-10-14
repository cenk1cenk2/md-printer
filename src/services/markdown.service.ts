import { Injectable } from '@nestjs/common'
import { all } from 'lowlight'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

@Injectable()
export class MarkdownService {
  private readonly processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeHighlight, { languages: all })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .freeze()

  public render(markdown: string): string {
    return String(this.processor.processSync(markdown))
  }
}
