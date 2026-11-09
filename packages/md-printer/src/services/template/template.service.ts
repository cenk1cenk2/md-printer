import { Injectable } from '@nestjs/common'
import { compile as compileTailwind } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import { kebabCase } from 'change-case'
import enhancedResolve from 'enhanced-resolve'
import { decodeHTML } from 'entities'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { homedir } from 'os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { rolldown } from 'rolldown'
import { render } from 'svelte/server'
import { fileURLToPath, pathToFileURL } from 'url'

import { inlineCss, inlineHtml, resolveConfined } from './assets.js'
import { sveltePlugin } from './svelte.plugin.js'
import type { TemplatePackageSource, TemplateSource } from './template.schema.js'
import { issues, TemplateSettingsSchema } from './template.schema.js'
import { FileSystemService } from '@cenk1cenk2/oclif-common'
import { ContextKey, Directory, RenderMode, TEMPLATE_EXTENSION_FILES, TEMPLATE_LAYOUT, TEMPLATE_PACKAGE_PREFIX, TemplateFiles, TemplateSourceType } from '@constants'
import type {
  AssetCache,
  CompiledModule,
  DocumentContext,
  MarkdownNode,
  MdPrinterSettings,
  MdPrinterTemplateFiles,
  RenderedDocument,
  RenderedPart,
  ResolvedTemplate,
  TemplateBundle,
  TemplatePaths,
  TemplateRenderOptions,
  TemplateStylesheet
} from '@interfaces'

@Injectable()
export class TemplateService {
  private static readonly ROOT = fileURLToPath(new URL('../../../', import.meta.url))
  private static readonly COMPONENTS = fileURLToPath(new URL(`../../${Directory.COMPONENTS}/index.ts`, import.meta.url))
  private static readonly ENTRY = fileURLToPath(new URL('./render.entry.ts', import.meta.url))

  private readonly require = createRequire(TemplateService.ROOT)
  // the same resolvers Tailwind uses, so package `exports` and `style` entries resolve from md-printer's own dependencies too
  private readonly stylesheets = enhancedResolve.create.sync({
    extensions: ['.css'],
    mainFields: ['style'],
    conditionNames: ['style']
  })
  private readonly modules = enhancedResolve.create.sync({
    extensions: ['.js', '.json', '.node', '.ts'],
    conditionNames: ['node', 'import']
  })

  constructor(private readonly fs: FileSystemService) {}

  public async resolve(template: string | TemplateSource, base: string): Promise<ResolvedTemplate> {
    const directory = await this.locate(template, base)
    const settings = await this.settings(directory)

    return {
      directory,
      settings,
      files: await this.paths(directory, settings.files)
    }
  }

  public async bundle(files: TemplatePaths): Promise<TemplateBundle> {
    const stylesheets: TemplateStylesheet[] = []
    const { module: entry, modules } = await this.compile(TemplateService.ENTRY, stylesheets, files)

    return {
      template: files.template,
      entry,
      modules,
      stylesheets,
      directives: new Map(Object.keys(entry.components).map((name) => [kebabCase(name), name]))
    }
  }

  public async page(file: string): Promise<string> {
    const { module } = await this.compile(file, [], { directory: dirname(file), template: file })

    return `<!doctype html>${render(module.default).body}`
  }

  public async render(directory: string, bundle: TemplateBundle, document: DocumentContext, markdown: MarkdownNode[], options: TemplateRenderOptions): Promise<RenderedDocument> {
    const context: [string, unknown][] = [
      [ContextKey.DOCUMENT, document],
      [ContextKey.MARKDOWN, markdown],
      [ContextKey.COMPONENTS, bundle.entry.components],
      [ContextKey.EXTENSION, bundle.entry.extension]
    ]
    const props = {
      ...document,
      extension: bundle.entry.extension,
      content: bundle.entry.content(markdown, context)
    }
    const [body, header, footer] = await Promise.all(
      [RenderMode.BODY, RenderMode.HEADER, RenderMode.FOOTER].map((mode) => bundle.entry.part(props, [...context, [ContextKey.RENDER_MODE, mode]]))
    )

    const dependencies: string[] = []
    // shared by the header and the footer, so a remote logo is fetched once per build
    const cache: AssetCache = new Map()
    const css = `<style>${await this.css(directory, bundle, [body, header, footer].map((part) => part.body).join(''), options.highlight, dependencies)}</style>`
    // svelte already escaped the template's title, and the document shell escapes it again
    const extracted = body.head.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const title = options.title ?? (extracted && decodeHTML(extracted)) ?? options.fallbackTitle
    const head = body.head.replace(/<title>[\s\S]*?<\/title>/, '')
    const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(([style]) => style).join('') + css

    return {
      html: bundle.entry.document({
        lang: options.language,
        title,
        head: head + css,
        body: body.body
      }),
      header: await this.margin(bundle, header, styles, directory, cache, dependencies),
      footer: await this.margin(bundle, footer, styles, directory, cache, dependencies),
      dependencies
    }
  }

  private locate(template: string | TemplateSource, base: string): Promise<string> | string {
    if (typeof template === 'string') {
      const path = this.expand(template)

      return isAbsolute(path) || path.startsWith('.') || /[\\/]/.test(path) ? resolve(path) : this.builtin(path)
    }

    switch (template.type) {
      case TemplateSourceType.BUILTIN:
        return this.builtin(template.name)

      case TemplateSourceType.PACKAGE:
        return this.package(template, base)

      case TemplateSourceType.DIRECTORY:
        return resolve(base, this.expand(template.path))
    }
  }

  private expand(path: string): string {
    return path.replace(/^~(?=\/|$)/, homedir())
  }

  /** A built-in template is a package of its own, so it brings its own fonts, icons and stylesheets as dependencies. */
  private builtin(name: string): string {
    const pkg = `${TEMPLATE_PACKAGE_PREFIX}${name}`

    try {
      return dirname(this.require.resolve(`${pkg}/package.json`))
    } catch {
      throw new Error(`Template does not exist, expected the built-in template package ${pkg} or a path to a template directory.`)
    }
  }

  private async package({ name, directory }: TemplatePackageSource, base: string): Promise<string> {
    const root = this.installed(name, [...new Set([base, process.cwd()]), TemplateService.ROOT])

    if (directory === undefined) {
      return root
    }

    const confined = await resolveConfined(resolve(root, directory), root)

    if (!confined) {
      throw new Error(`Template directory "${directory}" of the package ${name} has to exist inside the package: ${root}`)
    }

    return confined
  }

  private installed(name: string, roots: string[]): string {
    for (const root of roots) {
      try {
        return dirname(createRequire(join(root, 'package.json')).resolve(`${name}/package.json`))
      } catch {
        continue
      }
    }

    throw new Error(`Template does not exist, the package ${name} is not installed in any of: ${roots.join(', ')}`)
  }

  private async settings(directory: string): Promise<MdPrinterSettings> {
    const file = join(directory, TemplateFiles.SETTINGS)

    if (!this.fs.exists(file)) {
      return {}
    }

    const { success, data, error } = TemplateSettingsSchema.safeParse(JSON.parse(await this.fs.read(file)))

    if (!success) {
      throw new Error(`Template settings are invalid in ${file}: ${issues(error)}`)
    }

    return data as MdPrinterSettings
  }

  private async paths(directory: string, files: MdPrinterTemplateFiles = {}): Promise<TemplatePaths> {
    const template = files.template ? await this.configured(directory, 'template', files.template) : this.first(directory, TEMPLATE_LAYOUT.template)
    const components = files.components
      ? await Promise.all([files.components].flat().map((path) => this.configured(directory, 'components', path)))
      : [this.first(directory, TEMPLATE_LAYOUT.components) ?? join(directory, TEMPLATE_LAYOUT.components[0])]
    const i18n = files.i18n
      ? await Promise.all([files.i18n].flat().map((path) => this.configured(directory, 'i18n', path)))
      : [this.first(directory, TEMPLATE_LAYOUT.i18n) ?? join(directory, TEMPLATE_LAYOUT.i18n[0])]
    const extension = files.extension
      ? await Promise.all([files.extension].flat().map((path) => this.configured(directory, 'extension', path)))
      : [this.extension(directory)].filter((path) => path !== undefined)

    if (!template) {
      throw new Error(`Template does not exist, expected ${TEMPLATE_LAYOUT.template.join(' or ')} in: ${directory}`)
    }

    return {
      directory,
      template,
      components,
      i18n,
      extension,
      candidates: [
        ...(files.template ? [template] : TEMPLATE_LAYOUT.template.map((path) => join(directory, path))),
        ...(files.components ? components : TEMPLATE_LAYOUT.components.map((path) => join(directory, path))),
        ...(files.i18n ? i18n : TEMPLATE_LAYOUT.i18n.map((path) => join(directory, path))),
        ...(files.extension ? extension : TEMPLATE_LAYOUT.extension.flatMap((path) => TEMPLATE_EXTENSION_FILES.map((file) => join(directory, path, file))))
      ]
    }
  }

  private async configured(directory: string, key: string, value: string): Promise<string> {
    const path = resolve(directory, value)
    const rel = relative(directory, path)
    const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)

    if (!outside && !this.fs.exists(path)) {
      throw new Error(`Template settings point files.${key} to a path that does not exist: ${path}`)
    }

    if (outside || !(await resolveConfined(path, directory))) {
      throw new Error(`Template settings point files.${key} outside of the template directory: ${value}`)
    }

    return path
  }

  private first(directory: string, paths: string[]): string | undefined {
    return paths.map((path) => join(directory, path)).find((path) => this.fs.exists(path))
  }

  private extension(directory: string): string | undefined {
    for (const location of TEMPLATE_LAYOUT.extension) {
      const files = TEMPLATE_EXTENSION_FILES.filter((file) => this.fs.exists(join(directory, location, file)))

      if (files.length > 1) {
        throw new Error(`Template has more than one extension module, keep one of ${files.join(', ')} in: ${join(directory, location)}`)
      }

      if (files.length === 1) {
        return join(directory, location, files[0])
      }
    }

    return undefined
  }

  private async compile(input: string, stylesheets: TemplateStylesheet[], files: Pick<TemplatePaths, 'directory' | 'template'> & Partial<TemplatePaths>): Promise<CompiledModule> {
    const build = await rolldown({
      input,
      platform: 'node',
      logLevel: 'warn',
      onLog(_, log, handler): void {
        // left alone, an unresolved import only fails when node loads the bundle, without naming the template
        if (log.code === 'UNRESOLVED_IMPORT') {
          handler('error', { ...log, message: `${log.message} Install it in the template directory: ${files.directory}` })
        }
      },
      plugins: [
        sveltePlugin({
          template: files.template,
          components: TemplateService.COMPONENTS,
          templateComponents: files.components,
          root: TemplateService.ROOT,
          stylesheets,
          extension: files.extension
        })
      ]
    })

    try {
      const { output: [chunk] } = await build.generate({ format: 'esm', sourcemap: 'inline' })

      // a data: module has no location for the require of CommonJS modules to start from
      const code = chunk.code.replaceAll('createRequire(import.meta.url)', `createRequire(${JSON.stringify(pathToFileURL(files.template).href)})`)

      return {
        module: await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`),
        modules: chunk.moduleIds.filter((id) => isAbsolute(id))
      }
    } finally {
      await build.close()
    }
  }

  private async margin(bundle: TemplateBundle, part: RenderedPart, styles: string, directory: string, cache: AssetCache, dependencies: string[]): Promise<string | undefined> {
    if (!part.body.replace(/<!--[\s\S]*?-->/g, '').trim()) {
      return undefined
    }

    const { content, assets } = await inlineHtml(bundle.entry.margin({ styles, body: part.body }), directory, { remote: true, cache })

    dependencies.push(...assets)

    return content
  }

  private async css(directory: string, bundle: TemplateBundle, html: string, highlight: string, dependencies: string[]): Promise<string> {
    // nested under :root so the theme outranks template stylesheets like github-markdown-css, which clear the code block background
    const theme = `:root { ${readFileSync(this.highlightTheme(highlight), 'utf8')} pre:has(> code.hljs) { padding: 0; background: transparent; } }`

    const compiler = await compileTailwind([theme, ...bundle.stylesheets.map(({ source }) => source)].join('\n'), {
      base: directory,
      from: bundle.stylesheets[0]?.file ?? bundle.template,
      shouldRewriteUrls: true,
      onDependency: (path) => dependencies.push(path),
      customCssResolver: async(id, base) => this.resolveFrom(this.stylesheets, id, [base, directory, TemplateService.ROOT]),
      customJsResolver: async(id, base) => this.resolveFrom(this.modules, id, [base, directory, TemplateService.ROOT])
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

    const { content, assets } = await inlineCss(compiler.build([...scanner.scan(), ...scanner.scanFiles([{ content: html, extension: 'html' }])]), directory)

    dependencies.push(...assets)

    return content
  }

  /**
   * Tries every base in turn, since a template directory usually has no `node_modules` and falls back to md-printer's own dependencies.
   */
  private resolveFrom(resolver: ReturnType<typeof enhancedResolve.create.sync>, id: string, bases: string[]): string | undefined {
    for (const base of bases) {
      try {
        const resolved = resolver(base, id)

        if (resolved) {
          return resolved
        }
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
