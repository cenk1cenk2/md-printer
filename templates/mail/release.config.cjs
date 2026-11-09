module.exports = {
  extends: '@cenk1cenk2/semantic-release-config',
  plugins: [
    ['@cenk1cenk2/semantic-release-config/presets/npm', { publish: 'staged', client: 'pnpm', workspace: '@cenk1cenk2/md-printer-template-mail' }],
    ['@semantic-release/gitlab', { successCommentCondition: false }]
  ]
}
