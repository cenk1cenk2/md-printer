// multi-semantic-release tags every package as <name>@<version>, so this package continues from the tag
// @cenk1cenk2/md-printer@3.2.24, which marks the last release made under the former v<version> tags
module.exports = {
  extends: '@cenk1cenk2/semantic-release-config',
  plugins: [
    [
      '@cenk1cenk2/semantic-release-config/presets/npm',
      { publish: 'staged', client: 'pnpm', workspace: '@cenk1cenk2/md-printer' }
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/sync-manifest-version.mjs ${nextRelease.version}'
      }
    ],
    // every package of the workspace would comment on the same merge requests
    ['@semantic-release/gitlab', { successCommentCondition: false }]
  ]
}
