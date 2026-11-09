# md-printer

Render markdown or yaml through Svelte templates into PDF or HTML.

This repository is a pnpm workspace:

| Package | Directory | |
| --- | --- | --- |
| [`@cenk1cenk2/md-printer`](packages/md-printer/README.md) | `packages/md-printer` | The CLI. |
| `@cenk1cenk2/md-printer-template-<name>` | `templates/<name>` | One package per built-in template, with the fonts, icons and stylesheets it uses as its dependencies. |

Every package is released on its own by multi-semantic-release and tagged `<package>@<version>`.

```sh
pnpm install
pnpm build
pnpm test
```
