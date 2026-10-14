import { readFile } from 'fs/promises'
import { createRequire } from 'module'
import { extname } from 'path'
import type { Plugin } from 'rolldown'
import { compile, preprocess } from 'svelte/compiler'
import { pathToFileURL } from 'url'

import { dataUri, isInlinableAsset } from './assets.js'
import { ModuleSpecifier, TAILWIND_STYLE_LANG } from '@constants'
import type { SveltePluginOptions } from '@interfaces'

/**
 * Compiles Svelte components for server-side rendering and resolves md-printer's own modules: the template entry, the shipped components and
 * `svelte` itself, which points at md-printer's copy since templates can live outside any `node_modules`. `<style lang="postcss">` blocks are taken
 * out of the components and collected, so the template's stylesheet is compiled once by Tailwind. Imported images become data URIs.
 */
export function sveltePlugin({ template, components, root, stylesheets }: SveltePluginOptions): Plugin {
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

      if (id === 'svelte' || id.startsWith('svelte/')) {
        // external so every bundle shares md-printer's single svelte runtime
        return { id: pathToFileURL(require.resolve(id)).href, external: true }
      }

      return null
    },

    async load(id: string): Promise<string | null> {
      if (!isInlinableAsset(id)) {
        return null
      }

      return `export default ${JSON.stringify(dataUri(id, await readFile(id)))}`
    },

    async transform(code: string, id: string): Promise<{ code: string; map: ReturnType<typeof compile>['js']['map'] } | null> {
      if (extname(id) !== '.svelte') {
        return null
      }

      const { code: source } = await preprocess(
        code,
        {
          style: ({ content, attributes }): { code: string } | undefined => {
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
