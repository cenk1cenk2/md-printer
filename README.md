# md-printer

Renders a Markdown or YAML file through a Svelte template into a PDF or HTML document. The PDF is printed by a locally installed Chromium-based browser, so there is no bundled Chrome download.

## Install

```sh
npm i -g @cenk1cenk2/md-printer
```

### Requirements

- Node.js >= 24.15.
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

# write to stdout, logs go to stderr
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
- Output is written atomically: a temporary file next to it is renamed into place, keeping the mode and owner of an existing file.
- `dest` in front-matter and the output argument resolve against the current directory, while local assets resolve against the directory of the input file (the current directory for stdin).
- Only files inside the input directory are loaded, for PDF and HTML alike. Symlinks are followed first, so a link pointing outside the directory is not loaded either. Remote images are loaded as they are.
- HTML output inlines local images as data URIs: image attributes (`src`, `srcset`, `poster`), `style` attributes and `<style>` blocks. Text and code samples are never rewritten.
- `-T, --title` sets the document title, see [precedence](#precedence).

## Markdown

Markdown is rendered with [unified](https://unifiedjs.com): GitHub flavoured markdown (tables, task lists, footnotes, autolinks), heading ids, syntax highlighting with the selected highlight.js theme, and raw HTML, which is parsed as well, so a heading or code block written in HTML gets its id and highlighting too.

`::pagebreak` on its own line starts a new page. It works anywhere, also inside flex or grid layouts, and in continuous mode, where every part becomes a page of its own height. `<div class="page-break"></div>` in HTML and the `PageBreak` component (`::page-break`) do the same.

### Components

Markdown places Svelte components with [directives](https://github.com/remarkjs/remark-directive). The template's components and the [shared components](#shared-components) are available by their file name in kebab case, `PaymentInfo.svelte` as `payment-info`:

```md
::payment-info{iban="AT00 0000" due="14"}

:::callout{type="warning"}
Inner markdown, **bold** included, is rendered and passed as `children`.
:::

Total :items[3 items]{count="3"} so far.
```

- `::name{...}` on its own line is a leaf component without children.
- `:::name{...}` up to a closing `:::` is a container. Its content is rendered as markdown and passed as the `children` snippet.
- `:name[label]{...}` inside text is inline. The label is passed as `children`.
- Attributes are passed as props, always as strings: `{count="3"}` gives `count: '3'`. `{.note #intro flag}` gives `class`, `id` and `flag: ''`.
- A name without a component stays the text it was written as, so `10:30am`, `note:here` or `::unknown` are printed unchanged.

## Front-matter and settings

Markdown files take YAML front-matter. For YAML input the same keys are top-level keys of the file. All other keys are passed to the template as `data`.

| Key               | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `template`        | Built-in template name or path to a template directory.                                       |
| `dest`            | Output file, relative to the current directory, not to the input file.                        |
| `outputFiletype` | `pdf` (default) or `html`.                                                                    |
| `language`        | Language for template translations.                                                           |
| `continuous`      | `true` renders one page per part, each as tall as its content, split only at page breaks.     |
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

The default `pdfOptions` are `format: A4`, `printBackground: true` and a margin of `30mm 40mm 30mm 20mm` (top, right, bottom, left). `pdfOptions` are merged recursively, so a document can override single keys. `margin` may be a CSS shorthand string such as `"18mm 12mm"`, and plain numbers are pixels, in continuous mode too.

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
md-printer document.md out.pdf --preview --no-open
```

- `-p, --preview` rebuilds when the input file, the template (components, imports, `settings.json`, translations) or a local asset used by the page changes. Every build rewrites the output file, the same one a normal run writes; reading from stdin without an output argument only previews. `-O` is not supported.
- It starts a local preview server and opens it in an app window of the discovered browser, using a throwaway profile. The page has HTML, Split and PDF tabs. Build errors, such as Svelte compile errors, are shown in an overlay and cleared by the next successful build. Closing the window ends the session. Ctrl+C ends it too, after closing the browser, the preview server and the watcher, and exits with 130; a second Ctrl+C exits at once.
  - `--host` sets the loopback host, default `127.0.0.1`.
  - `--port` sets the port, default `0` (random). A port in use fails the run with an error.
  - It serves the files next to the input, except dotfiles such as `.env`.
  - `--no-open` does not open a window: md-printer keeps rebuilding and writing until Ctrl+C, and the printed URL can be opened by hand.
- Signing is skipped while previewing. Run without `--preview` to sign.

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
  components/       optional, *.svelte placed from markdown, see Markdown components
```

`Template.svelte` is a Svelte 5 component receiving these props:

| Prop        | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `data`      | Front-matter (or the YAML file) as an object.                                                |
| `content`   | The Markdown body rendered to HTML, with the components of directives rendered in place. Empty for YAML input. |
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
| `Markdown`       | Renders the Markdown body in an `<article class="markdown-body">`, styled by `github-markdown-css` if the template imports it. Directives render as live components. |
| `PageBreak`      | Starts a new page anywhere, also in continuous mode. In markdown, `::page-break` or `::pagebreak` does the same. |
| `PageNumber`     | Current page number, filled by Chrome. Header and footer only.                                    |
| `TotalPages`     | Total page count, filled by Chrome. Header and footer only.                                       |
| `Title`          | Document title, filled by Chrome. Header and footer only.                                         |
| `Date`           | Print date, filled by Chrome. Header and footer only.                                             |
| `SignatureBlock` | Visible signature block for the `signature` prop. Needs Tailwind in a `<style lang="postcss">` block. Optional `labels` prop overrides its texts. |

```svelte
<script>
  import { Markdown, Page, PageNumber, TotalPages, Title } from '@cenk1cenk2/md-printer/components'

  let { data } = $props()
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

  <Markdown />
</Page>
```

#### Markdown components

Every `*.svelte` file in the template's `components/` directory can be placed from markdown, see [Components](#components). The shared components can be placed the same way, for example `::page-break` or `::signature-block`, except `Markdown`. A template component with the same name as a shared one replaces it.

```svelte
<!-- components/Callout.svelte -->
<script>
  import { getContext } from 'svelte'

  let { type = 'note', children } = $props()

  const { data, t, language, signature } = getContext('md-printer:document')
</script>

<aside class="callout callout-{type}">
  <strong>{t(type)}</strong>
  {@render children?.()}
</aside>
```

- Props are the directive's attributes, always strings, and `children` for containers and inline directives.
- `getContext('md-printer:document')` gives `{ data, t, language, signature }`, the template's props, so a component needs nothing passed down.
- `<Markdown />` renders the components in place. A template that places `{@html content}` gets their rendered markup instead, without their scoped `<style>` blocks, so style them with Tailwind classes or a `<style lang="postcss">` block.
- A component can start new pages with `PageBreak` or an element with the `page-break` class.
- `--preview` picks up added and removed component files.

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
- Signing only works for PDF output and is skipped with `--preview`.
- The signing session has to run in your browser. md-printer opens a temporary local page in an app window of the discovered browser, using your normal profile (or with `xdg-open` when none is found), you log in with ID Austria in the A-Trust page, and paste the resulting signature (starts with `MII`) back into the local page. A paste that is cut short is refused on the page, so you can copy it again. It waits until the signature arrives, press Ctrl+C to abort.
- The returned signature is always verified before it is embedded: its digest must match this document and it must be cryptographically valid. The result is printed with the signer name, serial and issuer. A failed verification fails the run, and with `--log-level debug` the returned signature is written next to the output as `<output>.cms.der`.
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
- `--dev` is replaced by `--preview`, which also rebuilds and rewrites the output on every change; there is no separate `--watch`.
- The default highlight theme is `atom-one-dark`.
- Files with an unknown extension are read as markdown, as before; `-f` still forces a type.
- The update notifier and the did-you-mean suggestion for mistyped commands are removed, md-printer is a single command.

## Command reference

```
Renders a markdown or yaml file through a Svelte template into a PDF or HTML document.

USAGE
  $ md-printer  [FILE] [OUTPUT] [--log-level
    silent|direct|fatal|error|warn|info|verbose|debug|trace] [-I] [-f
    md|yaml|yml] [-F pdf|html] [-O] [-t <value>] [-T <value>] [-l <value>] [-b
    <value>] [--continuous] [-p] [--host 127.0.0.1|localhost|::1] [--port
    <value>] [--open] [--sign] [--sign-provider a-trust] [--sign-certificate
    <value>]

ARGUMENTS
  [FILE]    Markdown or yaml file to render.
  [OUTPUT]  Output file. Overwrites the one defined in front-matter.

FLAGS
  -F, --output-filetype=<option>  Output file type, defaults to pdf. Overwrites
                                  the one defined in front-matter.
                                  <options: pdf|html>
  -I, --stdin                     Read the input from stdin.
  -O, --stdout                    Write the output to stdout instead of a file.
  -T, --title=<value>             Document title. Overwrites the one defined in
                                  front-matter or the template.
  -b, --browser=<value>           Browser executable used for printing.
                                  Discovered automatically when omitted (Brave,
                                  Chrome, Chromium, Edge).
  -f, --input-filetype=<option>   Input file type. Detected from the file
                                  extension, markdown for stdin and unknown
                                  extensions.
                                  <options: md|yaml|yml>
  -l, --language=<value>          Language for template translations. Overwrites
                                  the one defined in front-matter and template
                                  settings.
  -p, --preview                   Rebuild whenever the input, the template or
                                  its assets change, show the HTML and the PDF
                                  in a live preview and rewrite the output file
                                  when there is one.
  -t, --template=<value>          Built-in template name or path to a template
                                  directory, defaults to "default". Overwrites
                                  the one defined in front-matter.
      --continuous                Render the PDF as a single continuous page
                                  without page breaks.
      --host=<option>             [default: 127.0.0.1] Loopback host for the
                                  preview server, it serves the files next to
                                  the input and is never exposed to the network.
                                  <options: 127.0.0.1|localhost|::1>
      --[no-]open                 Open the preview window, --no-open keeps
                                  rebuilding and writing without one.
      --port=<value>              Port for the preview server, random when 0.
      --sign                      Sign the PDF with a qualified electronic
                                  signature through ID Austria (A-Trust).
      --sign-certificate=<value>  Signer certificate (DER or PEM) used for the
                                  visible signature block and to verify the
                                  returned signature.
      --sign-provider=<option>    Signature provider, defaults to a-trust.
                                  Overwrites the one defined in front-matter and
                                  template settings.
                                  <options: a-trust>

CLI FLAGS
  --log-level=<option>  [default: INFO, env: LOG_LEVEL] Set the log level of the
                        application.
                        <options:
                        silent|direct|fatal|error|warn|info|verbose|debug|trace>

DESCRIPTION
  Renders a markdown or yaml file through a Svelte template into a PDF or HTML
  document.
```
