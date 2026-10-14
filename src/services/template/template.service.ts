import { Injectable } from '@nestjs/common'
import { compile as compileTailwind } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { homedir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import { rolldown } from 'rolldown'
import { render } from 'svelte/server'
import { fileURLToPath } from 'url'

import { inlineAssets } from './assets.js'
import { sveltePlugin } from './svelte.plugin.js'
import { FileSystemService } from '@cenk1cenk2/oclif-common'
import { ContextKey, Directory, RenderMode, TemplateFiles } from '@constants'
import type { MdPrinterSettings, RenderedDocument, RenderedPart, TemplateBundle, TemplateContext, TemplateProps, TemplateRenderOptions, TemplateStylesheet } from '@interfaces'

@Injectable()
export class TemplateService {
  private static readonly ROOT = fileURLToPath(new URL('../../../', import.meta.url))
  private static readonly COMPONENTS = fileURLToPath(new URL(`../../${Directory.COMPONENTS}/index.ts`, import.meta.url))
  private static readonly ENTRY = fileURLToPath(new URL('./render.entry.ts', import.meta.url))

  private readonly require = createRequire(TemplateService.ROOT)

  constructor(private readonly fs: FileSystemService) {}

  public resolve(template: string): string {
    const path = template.replace(/^~(?=\/|$)/, homedir())
    const directory = isAbsolute(path) || path.startsWith('.') || /[\\/]/.test(path) ? resolve(path) : join(TemplateService.ROOT, Directory.TEMPLATES, path)

    if (!this.fs.exists(join(directory, TemplateFiles.TEMPLATE))) {
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
    const stylesheets: TemplateStylesheet[] = []
    const { module: entry, modules } = await this.compile(TemplateService.ENTRY, join(directory, TemplateFiles.TEMPLATE), stylesheets)

    return {
      entry,
      modules,
      stylesheets
    }
  }

  /**
   * Renders a standalone Svelte page that takes no props, such as the preview shell.
   */
  public async page(file: string): Promise<string> {
    const { module } = await this.compile(file, file, [])

    return `<!doctype html>${render(module.default).body}`
  }

  public async render(directory: string, bundle: TemplateBundle, props: TemplateProps, context: TemplateContext, options: TemplateRenderOptions): Promise<RenderedDocument> {
    const [body, header, footer] = await Promise.all(
      [RenderMode.BODY, RenderMode.HEADER, RenderMode.FOOTER].map((mode) =>
        bundle.entry.part(props, [
          [ContextKey.RENDER_MODE, mode],
          [ContextKey.MARKDOWN, context.markdown]
        ])
      )
    )

    const dependencies: string[] = []
    const css = `<style>${await this.css(directory, bundle, [body, header, footer].map((part) => part.body).join(''), options.highlight, dependencies)}</style>`
    const title = options.title ?? body.head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? options.fallbackTitle
    const head = body.head.replace(/<title>[\s\S]*?<\/title>/, '')
    const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(([style]) => style).join('') + css

    return {
      title,
      html: bundle.entry.document({
        lang: options.language,
        title,
        head: head + css,
        body: body.body
      }),
      header: await this.margin(bundle, header, styles, directory),
      footer: await this.margin(bundle, footer, styles, directory),
      dependencies
    }
  }

  private async compile(input: string, template: string, stylesheets: TemplateStylesheet[]): Promise<{ module: any; modules: string[] }> {
    const build = await rolldown({
      input,
      platform: 'node',
      logLevel: 'silent',
      plugins: [
        sveltePlugin({
          template,
          components: TemplateService.COMPONENTS,
          root: TemplateService.ROOT,
          stylesheets
        })
      ]
    })

    try {
      const { output: [chunk] } = await build.generate({ format: 'esm', sourcemap: 'inline' })

      return {
        module: await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`),
        modules: chunk.moduleIds.filter((id) => isAbsolute(id))
      }
    } finally {
      await build.close()
    }
  }

  private async margin(bundle: TemplateBundle, part: RenderedPart, styles: string, directory: string): Promise<string | undefined> {
    if (!part.body.replace(/<!--[\s\S]*?-->/g, '').trim()) {
      return undefined
    }

    return inlineAssets(bundle.entry.margin({ styles, body: part.body }), directory, true)
  }

  private async css(directory: string, bundle: TemplateBundle, html: string, highlight: string, dependencies: string[]): Promise<string> {
    // nested under :root so the theme outranks template stylesheets like github-markdown-css, which clear the code block background
    const theme = `:root { ${readFileSync(this.highlightTheme(highlight), 'utf8')} pre:has(> code.hljs) { padding: 0; background: transparent; } }`

    const compiler = await compileTailwind([theme, ...bundle.stylesheets.map(({ source }) => source)].join('\n'), {
      base: directory,
      from: bundle.stylesheets[0]?.file ?? join(directory, TemplateFiles.TEMPLATE),
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

    return inlineAssets(compiler.build([...scanner.scan(), ...scanner.scanFiles([{ content: html, extension: 'html' }])]), directory)
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
    try {
      return this.require.resolve(`highlight.js/styles/${name}.css`)
    } catch {
      throw new Error(`Unknown highlight style "${name}", see the files in ${dirname(this.require.resolve('highlight.js/styles/github.css'))}.`)
    }
  }
}
