import { Injectable } from '@nestjs/common'
import { compile as compileTailwind } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { homedir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import { rolldown } from 'rolldown'
import { fileURLToPath } from 'url'

import { inlineAssets } from './assets.js'
import { sveltePlugin } from './svelte.plugin.js'
import { FileSystemService } from '@cenk1cenk2/oclif-common'
import { COMPONENTS_DIRECTORY, LEGACY_TEMPLATE_FILES, MARKDOWN_CONTEXT, RENDER_MODE_CONTEXT, RenderMode, TEMPLATE_DIRECTORY, TemplateFiles } from '@constants'
import type { MdPrinterSettings, RenderedDocument, RenderedPart, TemplateBundle, TemplateContext, TemplateProps } from '@interfaces'

export interface TemplateRenderOptions {
  language: string
  title?: string
  fallbackTitle?: string
  highlight: string
}

@Injectable()
export class TemplateService {
  private static readonly ROOT = fileURLToPath(new URL('../../../', import.meta.url))
  private static readonly COMPONENTS = fileURLToPath(new URL(`../../${COMPONENTS_DIRECTORY}/index.js`, import.meta.url))
  private static readonly ENTRY = 'md-printer:entry'

  private readonly require = createRequire(TemplateService.ROOT)

  constructor(private readonly fs: FileSystemService) {}

  public resolve(template: string): string {
    const path = template.replace(/^~(?=\/|$)/, homedir())
    const directory = isAbsolute(path) || path.startsWith('.') || /[\\/]/.test(path) ? resolve(path) : join(TemplateService.ROOT, TEMPLATE_DIRECTORY, path)

    if (!this.fs.exists(join(directory, TemplateFiles.TEMPLATE))) {
      if (LEGACY_TEMPLATE_FILES.some((file) => this.fs.exists(join(directory, file)))) {
        throw new Error(
          `Template uses the md-printer 2.x format, which is no longer supported. Migrate it to ${TemplateFiles.TEMPLATE}, see the templates section of the README: ${directory}`
        )
      }

      throw new Error(`Template does not exist, expected ${TemplateFiles.TEMPLATE} in: ${directory}`)
    }

    return directory
  }

  public async settings(directory: string): Promise<MdPrinterSettings> {
    const file = join(directory, TemplateFiles.SETTINGS)

    if (!this.fs.exists(file)) {
      return {}
    }

    return JSON.parse(await this.fs.read(file))
  }

  public async bundle(directory: string): Promise<TemplateBundle> {
    const entry = [
      'import { render } from \'svelte/server\'',
      `import Template from ${JSON.stringify(join(directory, TemplateFiles.TEMPLATE))}`,
      'export default (props, mode, context) => render(Template, { props, context: new Map(context) })'
    ].join('\n')

    const build = await rolldown({
      input: TemplateService.ENTRY,
      platform: 'node',
      logLevel: 'silent',
      plugins: [
        {
          name: 'md-printer:entry',
          resolveId: (id: string): string | null => (id === TemplateService.ENTRY ? id : null),
          load: (id: string): string | null => (id === TemplateService.ENTRY ? entry : null)
        },
        sveltePlugin({ components: TemplateService.COMPONENTS, root: TemplateService.ROOT })
      ]
    })

    try {
      const { output } = await build.generate({ format: 'esm', sourcemap: 'inline' })
      const [chunk] = output
      const { default: render } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)

      return {
        render: async(props: TemplateProps, mode: RenderMode, context: TemplateContext): Promise<RenderedPart> => {
          const { head, body } = await render(props, mode, [
            [RENDER_MODE_CONTEXT, mode],
            [MARKDOWN_CONTEXT, context.markdown]
          ])

          return { head, body }
        },
        modules: chunk.moduleIds.filter((id) => isAbsolute(id))
      }
    } finally {
      await build.close()
    }
  }

  public async render(directory: string, bundle: TemplateBundle, props: TemplateProps, context: TemplateContext, options: TemplateRenderOptions): Promise<RenderedDocument> {
    const [body, header, footer] = await Promise.all([RenderMode.BODY, RenderMode.HEADER, RenderMode.FOOTER].map((mode) => bundle.render(props, mode, context)))

    const dependencies: string[] = []
    const css = await this.css(directory, [body, header, footer].map((part) => part.body).join(''), options.highlight, dependencies)
    const styles = this.styles(body.head) + `<style>${css}</style>`
    const title = options.title ?? body.head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? options.fallbackTitle
    const head = body.head.replace(/<title>[\s\S]*?<\/title>/, '')

    return {
      title,
      html: [
        '<!doctype html>',
        `<html lang="${options.language}">`,
        `<head><meta charset="utf-8">${title !== undefined ? `<title>${title}</title>` : ''}${head}<style>${css}</style></head>`,
        `<body>${body.body}</body>`,
        '</html>'
      ].join(''),
      header: await this.part(header, styles, directory),
      footer: await this.part(footer, styles, directory),
      dependencies
    }
  }

  private async part(part: RenderedPart, styles: string, directory: string): Promise<string | undefined> {
    if (!part.body.replace(/<!--[\s\S]*?-->/g, '').trim()) {
      return undefined
    }

    return inlineAssets(
      `${styles}<div style="font-size: 10px; width: 100%; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact">${part.body}</div>`,
      directory,
      true
    )
  }

  private styles(head: string): string {
    return [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(([style]) => style).join('')
  }

  private async css(directory: string, html: string, highlight: string, dependencies: string[]): Promise<string> {
    const file = join(directory, TemplateFiles.STYLE)
    const theme = this.highlightTheme(highlight)
    const source = `@import ${JSON.stringify(theme)};\n${this.fs.exists(file) ? await this.fs.read(file) : ''}`

    const compiler = await compileTailwind(source, {
      base: directory,
      from: file,
      shouldRewriteUrls: true,
      onDependency: (path) => dependencies.push(path),
      customCssResolver: async(id, base) => this.resolveStylesheet(id, [base, directory, TemplateService.ROOT]),
      customJsResolver: async(id, base) => this.resolveModule(id, [base, directory, TemplateService.ROOT])
    })

    const scanner = new Scanner({
      sources: [
        ...compiler.sources.map(({ base, pattern, negated }) => ({
          base,
          pattern,
          negated
        })),
        {
          base: directory,
          pattern: '**/*',
          negated: false
        },
        {
          base: dirname(TemplateService.COMPONENTS),
          pattern: '**/*',
          negated: false
        }
      ]
    })

    const candidates = [...scanner.scan(), ...scanner.scanFiles([{ content: html, extension: 'html' }])]

    return inlineAssets(compiler.build(candidates), directory)
  }

  /**
   * Resolves bare stylesheet imports the way Tailwind does (the package's `style` entry or a subpath),
   * but also from md-printer's own dependencies, since a template directory usually has no `node_modules`.
   */
  private resolveStylesheet(id: string, bases: string[]): string | undefined {
    if (id.startsWith('.') || isAbsolute(id)) {
      return undefined
    }

    const [name, subpath] = id.match(/^((?:@[^/]+\/)?[^/]+)\/?(.*)$/).slice(1)

    for (const base of bases) {
      let manifest: string

      try {
        manifest = this.require.resolve(`${name}/package.json`, { paths: [base] })
      } catch {
        continue
      }

      const root = dirname(manifest)

      if (subpath) {
        return [join(root, subpath), join(root, `${subpath}.css`)].find((path) => this.fs.exists(path))
      }

      const { style } = JSON.parse(readFileSync(manifest, 'utf8'))

      return style ? join(root, style) : undefined
    }

    return undefined
  }

  private resolveModule(id: string, bases: string[]): string | undefined {
    for (const base of bases) {
      try {
        return this.require.resolve(id, { paths: [base] })
      } catch {
        continue
      }
    }

    return undefined
  }

  private highlightTheme(name: string): string {
    const theme = `highlight.js/styles/${name}.css`

    try {
      return this.require.resolve(theme)
    } catch {
      throw new Error(`Unknown highlight style "${name}", see the files in ${dirname(this.require.resolve('highlight.js/styles/github.css'))}.`)
    }
  }
}
