# md-printer

Renders a Markdown or YAML file through a Svelte template into a PDF or HTML document. The PDF is printed by a locally installed Chromium-based browser, so there is no bundled Chrome download.

<!-- toc -->
* [md-printer](#md-printer)
* [render to document.pdf in the current directory](#render-to-documentpdf-in-the-current-directory)
* [choose the output file](#choose-the-output-file)
* [write to stdout, logs are silenced](#write-to-stdout-logs-are-silenced)
* [read from stdin, the only argument is then the output](#read-from-stdin-the-only-argument-is-then-the-output)
* [template by built-in name or by path to a template directory](#template-by-built-in-name-or-by-path-to-a-template-directory)
* [language for template translations](#language-for-template-translations)
* [one single page without page breaks](#one-single-page-without-page-breaks)
* [HTML output instead of PDF](#html-output-instead-of-pdf)
<!-- tocstop -->

## Install

```sh
npm i -g @cenk1cenk2/md-printer
```

### Requirements

- Node.js >= 24.
- A Chromium-based browser. md-printer uses `puppeteer-core` and never downloads one.

The browser executable is resolved in this order:

1. `--browser <path>`. If this path is not executable, md-printer fails instead of falling back.
2. `PUPPETEER_EXECUTABLE_PATH`
3. `CHROME_PATH`
4. Brave, Chrome, Chromium, Edge, in that order, looked up by name on `PATH`. Only Linux is supported.

When running as root or when the `CI` environment variable is set, the browser is started with `--no-sandbox`, because Chromium refuses to start its sandbox as root, which is the default in CI containers.

## Usage

```sh
# render to document.pdf in the current directory
md-printer document.md

# choose the output file
md-printer document.md out/document.pdf

# write to stdout, logs are silenced
md-printer document.md -O > document.pdf

# read from stdin, the only argument is then the output
cat document.md | md-printer --stdin out.pdf

# template by built-in name or by path to a template directory
md-printer document.md -t kilic.dev
md-printer document.md -t ./my-template

# language for template translations
md-printer invoice.yaml -t invoice -l de

# one single page without page breaks
md-printer document.md --continuous

# HTML output instead of PDF
md-printer document.md -F html
```

- The input type is detected from the extension (`.md`, `.yaml`, `.yml`) and is markdown for stdin. Override it with `-f, --input-filetype`.
- YAML input has no body, the whole document is the `data` of the template. Invoices use this.
- The output defaults to `<input name>.<pdf|html>` in the current directory. Without an input file (stdin) there is no default, pass an output argument, `dest` in front-matter or `-O`.
- Output is written atomically (a temporary file is renamed into place).
- Local assets such as images referenced from the document resolve relative to the directory of the input file, or the current directory for stdin.
- `-T, --title` sets the document title, see [precedence](#precedence).

## Front-matter and settings

Markdown files take YAML front-matter. For YAML input the same keys are top-level keys of the file. All other keys are passed to the template as `data`.

| Key               | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `template`        | Built-in template name or path to a template directory.                                       |
| `dest`            | Output file, relative to the current directory.                                               |
| `outputFiletype` | `pdf` (default) or `html`.                                                                    |
| `language`        | Language for template translations.                                                           |
| `continuous`      | `true` renders a single page without page breaks.                                             |
| `documentTitle`  | Document title.                                                                               |
| `pdfOptions`     | Puppeteer [PDF options](https://pptr.dev/api/puppeteer.pdfoptions), merged over the defaults. |
| `sign`            | Signing options, see [Signing](#signing).                                                     |

A template may carry a `settings.json` with defaults for its documents:

| Key               | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `pdfOptions`     | Puppeteer PDF options.                                                                   |
| `i18n`            | `{ "language": "en", "fallback": "en" }`, default and fallback language of translations. |
| `sign`            | Signing options.                                                                         |
| `continuous`      | Render continuously by default.                                                          |
| `media`           | CSS media type used for printing, `screen` (default) or `print`.                         |
| `highlightStyle` | highlight.js theme name from `highlight.js/styles`, defaults to `atom-one-dark`.         |

The default `pdfOptions` are `format: A4`, `printBackground: true` and a margin of `30mm 40mm 30mm 20mm` (top, right, bottom, left). `pdfOptions` are merged recursively, so a document can override single keys. `margin` may be a CSS shorthand string such as `"18mm 12mm"`.

```yaml
---
template: kilic.dev
dest: ./out/report.pdf
language: de
documentTitle: Quarterly Report
pdfOptions:
  format: A4
  margin: 20mm
---
```

### Precedence

- General: flags > front-matter > template `settings.json` > defaults. `pdfOptions` are merged key by key in the order defaults, `settings.json`, front-matter.
- The language is `--language`, then `language`, then `settings.json` `i18n.language`, then `en`.
- `continuous` is enabled when any of `--continuous`, front-matter or `settings.json` enables it.
- The document title is `--title`, then `documentTitle`, then the `<title>` set by the template, then the input file name.

## Development

```sh
md-printer document.md --preview
md-printer document.md out.pdf --watch
md-printer document.md out.pdf --watch --preview
```

- `-p, --preview` starts a local preview server and opens it in an app window of the discovered browser, using a throwaway profile. The page has HTML, Split and PDF tabs. Build errors, such as Svelte compile errors, are shown in an overlay and cleared by the next successful build. Closing the window ends the session, as does Ctrl+C.
  - `--host` sets the host, default `127.0.0.1`.
  - `--port` sets the port, default `0` (random).
  - `--no-open` only prints the URL, so you can open it yourself.
- `-w, --watch` rebuilds when the input file, the template (components, imports, `settings.json`, translations) or a local asset used by the page changes, and rewrites the output file. Without `--preview` it keeps running until Ctrl+C. An output file is required, so `-O` is not supported.
- `--preview` alone does not write any file.
- Signing is skipped in both modes. Run without `--watch` and `--preview` to sign.

## Templates

### Built-in templates

| Name        | Description                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `default`   | GitHub-flavoured Markdown styling with Montserrat. This is the default.                                        |
| `kilic.dev` | Same styling with a logo in the header and a footer with title and page numbers.                               |
| `invoice`   | Invoice from YAML data (`company`, `client`, `payment`, `items`, `currency`, `date`, `id`) and Markdown notes. Translations in `en` and `de`, a signature block when signing. See `test/invoice.md`. |
| `mail`      | Plain content with no margin and Tailwind typography, meant for HTML output.                                   |

### Authoring a template

A template is a directory. Pass it with `-t ./path` or `template: ./path`. A value without a path separator is a built-in name, anything with `/` or starting with `.` or `~` is a path.

```
my-template/
  Template.svelte   required
  settings.json     optional
  i18n/             optional, en.yaml, de.json, ...
```

`Template.svelte` is a Svelte 5 component receiving these props:

| Prop        | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `data`      | Front-matter (or the YAML file) as an object.                                                |
| `content`   | The Markdown body rendered to HTML. Empty for YAML input.                                    |
| `t`         | i18next translate function, loaded from `i18n/<language>.(yaml\|yml\|json)`.                |
| `language`  | The resolved language.                                                                       |
| `signature` | `{ date, name?, issuer?, serial? }` while signing is enabled, otherwise `undefined`.         |

Set the document title with `<svelte:head><title>...</title></svelte:head>`.

Styles that need Tailwind CSS v4 or package imports go into a `<style lang="postcss">` block in `Template.svelte` or any component it imports. These blocks are collected and compiled together, so they can `@import 'tailwindcss'` and use `@plugin`, `@theme` and utility classes. Plain `<style>` blocks stay scoped Svelte styles. `@import` of packages (for example `@fontsource/*`, `github-markdown-css`) resolves from the template directory first and also from md-printer's own dependencies, so the template does not need a `node_modules`. The selected highlight.js theme is always included. Local `url()` and image references are inlined as data URIs.

Images are imported, which inlines them as data URIs:

```svelte
<script>
  import logo from './logo.png'
</script>

<img src={logo} alt="logo" />
```

#### Shared components

Import from `@cenk1cenk2/md-printer/components`:

| Component        | Description                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `Page`           | Layout wrapper. Children are the body, the `header` and `footer` snippets are the print header and footer of every page. |
| `Markdown`       | Renders `content` in an `<article class="markdown-body">`, styled by `github-markdown-css` if the template imports it. |
| `PageNumber`     | Current page number, filled by Chrome. Header and footer only.                                    |
| `TotalPages`     | Total page count, filled by Chrome. Header and footer only.                                       |
| `Title`          | Document title, filled by Chrome. Header and footer only.                                         |
| `Date`           | Print date, filled by Chrome. Header and footer only.                                             |
| `SignatureBlock` | Visible signature block for the `signature` prop. Needs Tailwind in a `<style lang="postcss">` block. Optional `labels` prop overrides its texts. |

```svelte
<script>
  import { Markdown, Page, PageNumber, TotalPages, Title } from '@cenk1cenk2/md-printer/components'

  let { data, content } = $props()
</script>

<svelte:head>
  <title>{data.documentTitle ?? 'Document'}</title>
</svelte:head>

<Page>
  {#snippet footer()}
    <div style="width: 100%; text-align: center; font-size: 8px">
      <Title /> - <PageNumber />/<TotalPages />
    </div>
  {/snippet}

  <Markdown {content} />
</Page>
```

#### Header and footer

The `header` and `footer` snippets are rendered into Chrome's print header and footer, which are isolated from the page. md-printer inlines the CSS and images for them automatically, including remote images, and the default font size is 10px. Chrome does not reserve space for them, so set `pdfOptions.margin` in `settings.json` or the front-matter large enough for what you render. Both are omitted in continuous mode.

Templates are code: Svelte components run on your machine when a document is rendered. Only use templates you trust.

## Signing

PDF output can be signed with a qualified electronic signature through ID Austria, using A-Trust.

```sh
md-printer invoice.yaml -t invoice --sign --sign-certificate ~/id-austria.pem
```

- `--sign` enables signing. `--sign-provider` selects the provider, `a-trust` is the only one and the default. `--sign-certificate` is a DER or PEM file of your signer certificate.
- The same keys can be set as `sign` in front-matter or `settings.json`: `enabled`, `provider`, `certificate`, `reason`, `location`, `contact`. Flags win. `reason`, `location` and `contact` are stored in the signature.
- Signing only works for PDF output and is skipped with `--watch` and `--preview`.
- The signing session has to run in your browser. md-printer opens a link to a temporary local page, you log in with ID Austria in the A-Trust page, and paste the resulting signature (starts with `MII`) back into the local page. It waits until the signature arrives, press Ctrl+C to abort.
- With a certificate, the signer name, issuer and serial are passed to the template as `signature`, so `SignatureBlock` can show who signed and when. The certificate must be valid at signing time, and the returned signature is rejected if it was not made with it. Without a certificate only the date is available.
- Verify the result at https://www.signaturpruefung.gv.at.

## Migrating from 2.x

- Nunjucks `template.html.j2`, `header.html`, `footer.html`, `main.css` and `tailwind.css` are replaced by `Template.svelte`, with styles in a `<style lang="postcss">` block.
- Removed from `settings.json` and front-matter: `body_class`, `css`, `stylesheet`, `script`, `marked_options`, `launch_options`, `gray_matter_options`. `documentTitle` in `settings.json` is removed too, set the title in the template.
- Front-matter on stdout is gone, use `-O`.
- `--title` now beats front-matter, and `--template` now beats front-matter.
- Assets resolve relative to the input file directory instead of the current directory.
- Continuous mode has no header and footer.
- `puppeteer` is replaced by `puppeteer-core`, there is no bundled Chrome, a local Chromium-based browser is required.
- `--dev` is replaced by `--preview`.
- The default highlight theme is `atom-one-dark`.

## Command reference

<!-- usage -->
```sh-session
$ npm install -g @cenk1cenk2/md-printer
$ md-printer COMMAND
running command...
$ md-printer (--version)
@cenk1cenk2/md-printer/2.20.5 linux-x64 node-v24.22.0
$ md-printer --help [COMMAND]
USAGE
  $ md-printer COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`md-printer [COMMAND]`](#md-printer-command)

## `md-printer [COMMAND]`

Display help for md-printer.

```
USAGE
  $ md-printer  [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for md-printer.
```
<!-- commandsstop -->
