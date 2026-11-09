import { configs, utils } from '@cenk1cenk2/eslint-config'
import svelte from '@cenk1cenk2/eslint-config/svelte-typescript'

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...configs['typescript-dynamic'],
  ...svelte,
  ...utils.configImportGroup({
    tsconfigDir: import.meta.dirname,
    tsconfig: 'tsconfig.json'
  }),
  {
    // the document and preview shells render <html> and <head>, which svelte-eslint-parser rejects although the compiler renders it
    ignores: [
      '**/dist/',
      'packages/md-printer/bin',
      'packages/md-printer/tsdown.config.ts',
      '**/release.config.cjs',
      'packages/md-printer/src/services/template/Document.svelte',
      'packages/md-printer/src/services/session/Preview.svelte'
    ]
  }
]
