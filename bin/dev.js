#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

import oclif from '@oclif/core'
import { join, dirname } from 'path'
import tsNode from 'ts-node'
import tsConfigPaths from 'tsconfig-paths'
import { fileURLToPath } from 'url'

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const project = join(__dirname, '..', 'tsconfig.json')

  // In dev mode -> use ts-node and dev plugins
  process.env.NODE_ENV = 'development'

  tsNode.register({ project })
  tsConfigPaths.register({
    baseUrl: dirname(project),
    paths: await import(project, { assert: { type: 'json' }, with: { type: 'json' } }).then((json) => {
      return json.default.compilerOptions.paths
    })
  })

  // In dev mode, always show stack traces
  oclif.settings.debug = true

  await import('source-map-support').then((lib) => lib.install())

  await import('@cenk1cenk2/oclif-common').then((mod) => mod.setup())

  const { execute } = await import('@oclif/core')

  await execute({ development: true, dir: import.meta.url })
}

await main()
