#!/usr/bin/env node

async function main() {
  const { execute } = await import('@oclif/core')

  await import('source-map-support').then((lib) => lib.install())

  await execute({ dir: import.meta.url })
}

await main()
