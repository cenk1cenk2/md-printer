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
    ignores: ['./dist/', './bin', './tsdown.config.ts', 'src/services/template/Document.svelte', 'src/services/session/Preview.svelte']
  }
]
