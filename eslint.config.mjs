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
    ignores: ['./dist/', './bin', './tsdown.config.ts']
  }
]
