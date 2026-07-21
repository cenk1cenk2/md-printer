import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

// The oclif manifest is generated during the build stage, before
// semantic-release bumps the version, so the published manifest would
// otherwise lag package.json and trigger oclif's version-mismatch warning.
// The publish image has no oclif to regenerate it, so patch the version
// field directly (invoked from release.config.cjs `prepareCmd`).

const {
  positionals: [version]
} = parseArgs({ allowPositionals: true })

if (!version) {
  throw new Error('usage: sync-manifest-version.mjs <version>')
}

const file = 'oclif.manifest.json'

if (existsSync(file)) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest.version = version
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}
