import { readFile } from 'fs/promises'
import { createRequire } from 'module'
import { extname } from 'path'
import type { Plugin } from 'rolldown'
import { compile } from 'svelte/compiler'
import { pathToFileURL } from 'url'

import { dataUri, isInlinableAsset } from './assets.js'
import { COMPONENTS_SPECIFIERS } from '@constants'

export interface SveltePluginOptions {
  components: string
  root: string
}

/**
 * Compiles Svelte components for server-side rendering, resolves the shipped components and points every `svelte` import at md-printer's own copy,
 * since templates can live outside any `node_modules`. Imported images become data URIs so they work in header/footer templates and HTML output.
 */
export function sveltePlugin({ components, root }: SveltePluginOptions): Plugin {
  const require = createRequire(root)

  return {
    name: 'md-printer:svelte',

    resolveId(id: string): string | { id: string; external: boolean } | null {
      if (COMPONENTS_SPECIFIERS.includes(id)) {
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

    transform(code: string, id: string): { code: string; map: ReturnType<typeof compile>['js']['map'] } | null {
      if (extname(id) !== '.svelte') {
        return null
      }

      const { js } = compile(code, {
        filename: id,
        generate: 'server',
        css: 'injected'
      })

      return { code: js.code, map: js.map }
    }
  }
}
