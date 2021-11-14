module.exports = {
  branches: [
    'master',
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
    }
  ],
  verifyConditions: [ '@semantic-release/changelog', '@semantic-release/git', '@semantic-release/npm' ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      '@semantic-release/git',
      {
        assets: [ 'CHANGELOG.md', 'package.json', 'README.md' ]
      }
    ],
    [ '@semantic-release/npm' ]
  ]
}
