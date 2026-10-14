import { Injectable } from '@nestjs/common'
import hljs from 'highlight.js'
import { Marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'

@Injectable()
export class MarkdownService {
  private readonly marked = new Marked(
    { gfm: true },
    gfmHeadingId(),
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight: (code, lang) => hljs.highlight(code, { language: hljs.getLanguage(lang) ? lang : 'plaintext' }).value
    })
  )

  public render(markdown: string): string {
    return this.marked.parse(markdown, { async: false })
  }
}
