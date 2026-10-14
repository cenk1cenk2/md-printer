/* eslint-disable import/no-extraneous-dependencies */
import { execa as command } from 'execa'
import { defineConfig } from 'tsdown'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entry: ['src/**/*.ts'],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  format: ['esm'],

  sourcemap: options.watch ? true : false,

  unbundle: true,
  keepNames: true,

  // components are compiled at runtime together with the template, so they ship as source
  copy: [{ from: ['src/**/*.html', 'src/components/**/*'], to: 'dist', flatten: false }],

  onSuccess: async (): Promise<void> => {
    await command('pnpm', ['run', 'manifest'], { stdout: process.stdout, stderr: process.stderr })
  }
}))
