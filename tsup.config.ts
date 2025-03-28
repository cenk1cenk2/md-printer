/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
import { execaCommand as command } from 'execa'
import { globby } from 'globby'
import { dirname, join } from 'path'
import { defineConfig } from 'tsup'

import { TEMPLATE_DIRECTORY } from './src/constants/template.constants'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entryPoints: ['./src/**'],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  target: 'es2022',
  format: ['esm'],

  sourcemap: true,

  bundle: false,
  splitting: false,
  clean: true,
  minify: false,
  keepNames: true,

  onSuccess: async (): Promise<void> => {
    await Promise.all([
      command('pnpm run manifest', { stdout: process.stdout, stderr: process.stderr }),
      command('pnpm exec tsconfig-replace-paths', { stdout: process.stdout, stderr: process.stderr })
    ])
  }
}))
