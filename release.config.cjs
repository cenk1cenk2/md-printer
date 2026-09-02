/* eslint-disable stylistic/max-len, stylistic/quotes -- publishCmd is a single long shell command with mixed quoting */
module.exports = {
  branches: [
    'main',
    'master',
    'next',
    'next-major',
    {
      name: 'alpha',
      prerelease: true
    },
    {
      name: 'beta',
      prerelease: true
    },
    {
      name: 'rc',
      prerelease: true
    },
    {
      name: 'rc',
      prerelease: true
    }
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/npm', { npmPublish: false }],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/sync-manifest-version.mjs ${nextRelease.version}',
        publishCmd:
          "npm stage publish ${nextRelease.channel ? \"--tag \" + nextRelease.channel : \"\"} > /dev/null && node -p \"JSON.stringify({ name: 'npm package', url: 'https://www.npmjs.com/package/' + require('./package.json').name + '/v/${nextRelease.version}', channel: '${nextRelease.channel || \"latest\"}' })\""
      }
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'README.md', 'package.json']
      }
    ],
    '@semantic-release/gitlab'
  ]
}
