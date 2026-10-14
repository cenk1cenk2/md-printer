/* eslint-disable import/no-extraneous-dependencies */
import { execa as command } from 'execa'
import { defineConfig } from 'tsdown'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entry: ['src/**/*.ts', '!src/**/*.entry.ts', '!src/components/**', '!src/types/**'],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  format: ['esm'],

  sourcemap: options.watch ? true : false,

  unbundle: true,
  keepNames: true,

  // template bundles are compiled at runtime, so their entry, shells and the shared components ship as source
  copy: [{ from: ['src/**/*.html', 'src/**/*.svelte', 'src/**/*.entry.ts', 'src/components/**/*'], to: 'dist', flatten: false }],

  onSuccess: async (): Promise<void> => {
    await command('pnpm', ['run', 'manifest'], { stdout: process.stdout, stderr: process.stderr })
  }
}))
