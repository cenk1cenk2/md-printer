/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
import { execaCommand as command } from 'execa'
import globby from 'globby'
import { dirname, join } from 'path'
import { defineConfig } from 'tsup'

import { TEMPLATE_DIRECTORY } from './src/constants/template.constants'

export default defineConfig((options) => ({
  name: !options.watch ? 'production' : undefined,

  entry: [ 'src/**/*.{js,ts}' ],
  tsconfig: options.watch ? 'tsconfig.json' : 'tsconfig.build.json',

  dts: options.watch ? true : false,

  format: [ 'cjs' ],

  target: [ 'es2021' ],

  sourcemap: options.watch ? true : false,

  splitting: false,
  clean: true,
  minify: false,
  keepNames: true,

  onSuccess: async (): Promise<void> => {
    await Promise.all([
      command('pnpm run manifest', { stdout: process.stdout, stderr: process.stderr }),
      command('pnpm exec tsconfig-replace-paths', { stdout: process.stdout, stderr: process.stderr }),
      // eslint-disable-next-line max-len
      ...await globby([ '**/tailwind.css' ], { cwd: join(TEMPLATE_DIRECTORY) }).then((paths) => {
        console.log('tailwind template builds:', paths)

        return paths.map((path) => command('tailwindcss -c ./tailwind.config.js -i ./tailwind.css -o ./main.css', { cwd: join(TEMPLATE_DIRECTORY, dirname(path)) }))
      })
    ])
  }
}))
