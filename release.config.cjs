module.exports = {
  extends: '@cenk1cenk2/semantic-release-config',
  plugins: [
    [
      '@cenk1cenk2/semantic-release-config/presets/npm',
      { publish: 'staged', client: 'pnpm' }
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/sync-manifest-version.mjs ${nextRelease.version}'
      }
    ],
    '@semantic-release/gitlab'
  ]
}
