/* eslint-disable import/no-extraneous-dependencies */
import execa from 'execa'
import { join } from 'path'
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

  onSuccess: async (): Promise<void> => {
    await Promise.all(
      // eslint-disable-next-line max-len
      [ 'privat-rechnung' ].map((path) => execa('tailwindcss', [ '-c', './tailwind.config.js', '-i', './tailwind.css', '-o', './main.css' ], { cwd: join(TEMPLATE_DIRECTORY, path) }))
    )

    // eslint-disable-next-line no-console
    console.log('Finished template builds.')
  }
}))
