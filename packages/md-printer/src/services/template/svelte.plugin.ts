import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { createRequire } from 'module'
import { basename, extname, join } from 'path'
import type { Plugin, TransformResult } from 'rolldown'
import type { Processed } from 'svelte/compiler'
import { compile, preprocess } from 'svelte/compiler'
import { pathToFileURL } from 'url'

import { dataUri, isInlinableAsset } from './assets.js'
import { ModuleSpecifier, TAILWIND_STYLE_LANG } from '@constants'
import type { SveltePluginOptions } from '@interfaces'

/**
 * `svelte` resolves to md-printer's copy, since templates can live outside any `node_modules`. `<style lang="postcss">` blocks are collected
 * instead of compiled per component, so the template's stylesheet goes through Tailwind once. `md-printer:template-components` maps the shared
 * components and the `*.svelte` files of the template's components directory by name, the template's winning. `md-printer:extension` is the extension module of the
 * template, or an empty module without one.
 */
export function sveltePlugin({ template, components, templateComponents, root, stylesheets, extension }: SveltePluginOptions): Plugin {
  const require = createRequire(root)

  return {
    name: 'md-printer:svelte',

    resolveId(id: string): string | { id: string; external: boolean } | null {
      if (id === ModuleSpecifier.TEMPLATE) {
        return template
      }

      if (id === ModuleSpecifier.COMPONENTS) {
        return components
      }

      if (id === ModuleSpecifier.TEMPLATE_COMPONENTS) {
        return `\0${id}`
      }

      if (id === ModuleSpecifier.EXTENSION) {
        return `\0${id}`
      }

      if (id === 'svelte' || id.startsWith('svelte/')) {
        // external so every bundle shares md-printer's single svelte runtime
        return { id: pathToFileURL(require.resolve(id)).href, external: true }
      }

      return null
    },

    async load(id: string): Promise<string | null> {
      if (id === `\0${ModuleSpecifier.TEMPLATE_COMPONENTS}`) {
        // in folder order, so a later folder replaces a component of the same name
        const files = (
          await Promise.all(
            (templateComponents ?? []).map(async(folder) =>
              existsSync(folder)
                ? (await readdir(folder))
                  .filter((file) => extname(file) === '.svelte')
                  .sort()
                  .map((file) => join(folder, file))
                : []
            )
          )
        ).flat()

        return [
          `import * as shared from ${JSON.stringify(ModuleSpecifier.COMPONENTS)}`,
          ...files.map((file, index) => `import $${index} from ${JSON.stringify(file)}`),
          // Markdown renders the whole document, so as a directive it would render itself forever, and getExtension is not a component
          'const { Markdown, getExtension, ...builtins } = shared',
          `export default { ...builtins, ${files.map((file, index) => `${JSON.stringify(basename(file, '.svelte'))}: $${index}`).join(', ')} }`
        ].join('\n')
      }

      if (id === `\0${ModuleSpecifier.EXTENSION}`) {
        const modules = extension ?? []

        return [
          ...modules.map((file, index) => `import * as $${index} from ${JSON.stringify(file)}`),
          // in order, so a later module replaces an export of the same name
          `export default [${modules.map((_, index) => `$${index}`).join(', ')}]`
        ].join('\n')
      }

      if (!isInlinableAsset(id)) {
        return null
      }

      return `export default ${JSON.stringify(dataUri(id, await readFile(id)))}`
    },

    async transform(code: string, id: string): Promise<TransformResult> {
      if (extname(id) !== '.svelte') {
        return null
      }

      const { code: source } = await preprocess(
        code,
        {
          style: ({ content, attributes }): Processed | undefined => {
            if (attributes.lang !== TAILWIND_STYLE_LANG) {
              return undefined
            }

            stylesheets.push({ file: id, source: content })

            return { code: '' }
          }
        },
        { filename: id }
      )

      const { js } = compile(source, {
        filename: id,
        generate: 'server',
        css: 'injected'
      })

      return { code: js.code, map: js.map }
    }
  }
}
