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
| `template`        | Built-in template name, path to a template directory or an object, see [Template sources](#template-sources). |
| `dest`            | Output file, relative to the current directory, not to the input file. Also an object, see [Output destination](#output-destination). |
| `outputFiletype` | `pdf` (default) or `html`.                                                                    |
| `language`        | Language for template translations.                                                           |
| `continuous`      | `true` renders one page per part, each as tall as its content, split only at page breaks.     |
| `documentTitle`  | Document title.                                                                               |
| `pdfOptions`     | Puppeteer [PDF options](https://pptr.dev/api/puppeteer.pdfoptions), merged over the defaults. |
| `sign`            | Signing options, see [Signing](#signing).                                                     |
| `attachments`     | PDFs merged into the output, see [Attachments and compression](#attachments-and-compression). |
| `compress`        | `true` compresses the images of the whole output PDF, attachments included.                   |

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

### Output destination

`dest` is a file path, or an object that splits it into a `directory` and a `filename`. Both keys are optional: `directory` defaults to the current directory and `filename` to `<input name>.<pdf|html>`, so a document can pick a folder and keep its own name. Without an input file (stdin) the object needs a `filename`.

```yaml
---
dest:
  directory: ./out
---
```

`document.md` with the front-matter above is written to `./out/document.pdf`. The output argument still wins over `dest` in either form.

### Precedence

- General: flags > front-matter > template `settings.json` > defaults. `pdfOptions` are merged key by key in the order defaults, `settings.json`, front-matter.
- The language is `--language`, then `language`, then `settings.json` `i18n.language`, then `en`.
- `continuous` is enabled when any of `--continuous`, front-matter or `settings.json` enables it.
- The document title is `--title`, then `documentTitle`, then the `<title>` set by the template, then the input file name.

## Attachments and compression

PDF output can carry other PDFs, such as certificates or reference letters, and can be compressed.

```yaml
---
compress: true
attachments:
  - file: ./assets/references/diploma.pdf
    position: before
  - file: https://example.com/certificate.pdf
    position: 2
    compress: true
  - file: ./assets/references/letter.pdf
---
```

- `file` is a path relative to the input file, confined to its directory like every other local asset, or an `http(s)` URL.
- `position` is `before` the document, `after` it (the default) or a page number: the attachment starts at that page of the rendered document, so `2` places it between the first and the second page, and the page after the last one appends it. Page numbers always count pages of the rendered document, not of other attachments, and attachments sharing a position keep the order they are listed in.
- `compress: true` on an attachment re-encodes its images, `compress: true` at the top level does the same for the whole output, attachments included. Images are scaled down to at most 2000px and stored as JPEG at quality 75 whenever that makes them smaller; masks and images with transparency keep their lossless encoding.
- Attachments and compression are applied before signing, so a signature covers them. They are only supported for PDF output.
- `--preview` rebuilds when a local attachment changes.

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

Every built-in template is a package of its own, `@cenk1cenk2/md-printer-template-<name>`. md-printer depends on all of them, so they install with it, and each one brings the fonts, icons and stylesheets it uses as its own dependencies. `default`, `kilic.dev` and `mail` are published from the `templates/` directory of this repository, `cv` from https://gitlab.kilic.dev/cenk/cv and `invoice` from https://gitlab.kilic.dev/cenk/invoices.

| Name        | Description                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `default`   | GitHub-flavoured Markdown styling with Montserrat. This is the default.                                        |
| `kilic.dev` | Same styling with a logo in the header and a footer with title and page numbers.                               |
| `invoice`   | Invoice from YAML data (`company`, `client`, `payment`, `items`, `currency`, `date`, `id`) and Markdown notes. Translations in `en` and `de`, a signature block when signing. See `test/invoice.md`. |
| `cv`        | CV in the table layout of a classic Word CV, from front-matter (`name`, `suffix`, `title`, `tagline`, `photo`) and Markdown sections placed with the `::section`, `:::details` / `::detail` / `:::pair`, `:::entry`, `::::group` / `:::course`, `::skill`, `:::note` and `:::languages` / `::language` components. The PDF is tagged and has an outline, so screening tools read it as text. See `test/cv.md`. |
| `mail`      | Plain content with no margin and Tailwind typography, meant for HTML output.                                   |

### Template sources

`-t` and a string `template` in front-matter take a built-in name or a path. A value without a path separator is a built-in name, anything with `/` or starting with `.` or `~` is a path, relative to the current directory.

`template` in front-matter can also be an object selecting the source by `type`. This is the only way to use a template from an npm package.

```yaml
---
template:
  type: package
  name: '@cenk1cenk2/md-printer-template-cv'
---
```

| `type`      | Keys                 | Description                                                                                                                                                                                                                                                  |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `builtin`   | `name`               | The package `@cenk1cenk2/md-printer-template-<name>` from md-printer's own dependencies.                                                                                                                                                                     |
| `package`   | `name`, `directory?` | An npm package, resolved from the directory of the input file (its `node_modules`, walking up like Node does), then from the current directory, then from md-printer's own dependencies. The package directory is the template directory. `directory` selects a subdirectory of the package instead, and may not leave the package, symlinks included. |
| `directory` | `path`               | A template directory, relative to the directory of the input file.                                                                                                                                                                                           |

The same on the command line, where flags win over front-matter. `--template-type` says how to read `-t`, and `--template-directory` is the `directory` of a package. A `--template-type directory` path is relative to the input file too. Without `--template-type`, `-t` is a built-in name or a path as above.

```sh
md-printer document.md --template-type package -t @cenk1cenk2/md-printer-template-cv
md-printer document.md --template-type package -t my-templates --template-directory letters
md-printer document.md --template-type builtin -t cv
md-printer document.md --template-type directory -t ./template
```

An unknown `type`, a missing or unknown key, or a `package` that is not installed fails the run. A package has to allow access to its `package.json`, so one with an `exports` map lists `./package.json` there.

### Authoring a template

A template is a directory. Pass it with `-t ./path`, `template: ./path` or as one of the other [template sources](#template-sources). Its Svelte files and its TypeScript are kept apart, so ESLint, Prettier and tsconfig can target each group:

```
my-template/
  package.json             optional, see below
  settings.json            optional, always at the root
  i18n/                    optional, en.yaml, de.json, ...
  template/
    Template.svelte        required
    components/*.svelte    optional, placed from markdown, see Markdown components
  src/
    extension.ts           optional, see Extension module
    *.ts                   optional, plain modules
```

`files` in `settings.json` moves any of these. Every key is optional and defaults to the layout above:

```json
{
  "files": {
    "template": "template/Template.svelte",
    "components": "template/components",
    "extension": "src/extension.ts",
    "i18n": "i18n"
  }
}
```

- `components`, `extension` and `i18n` also take an array, read in order: a component of a later folder replaces one of the same name, an export of a later extension module replaces one of the same name, and a key of a later i18n folder replaces the same key while nested keys merge. Use this to share components or translations between templates:

  ```json
  {
    "files": {
      "components": ["template/shared", "template/components"],
      "extension": ["src/format.ts", "src/extension.ts"],
      "i18n": ["i18n/shared", "i18n"]
    }
  }
  ```

- Paths are relative to the template directory. A path leaving it, a path that does not exist and an unknown key each fail the build.
- A template written for 3.x keeps working: for each key `files` does not set, when the default location is missing, the root location is used if it exists, that is `Template.svelte`, `components/` and `extension.*`. A path set in `files` never falls back.
- A package keeps what it does not publish out with an `.npmignore`, as the built-in templates do, for example `release.config.cjs` and `CHANGELOG.md`.

`Template.svelte` is a Svelte 5 component receiving these props:

| Prop        | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| `data`      | Front-matter (or the YAML file) as an object.                                                |
| `content`   | The Markdown body rendered to HTML, with the components of directives rendered in place. Empty for YAML input. |
| `t`         | i18next translate function, loaded from `i18n/<language>.(yaml\|yml\|json)`.                |
| `language`  | The resolved language.                                                                       |
| `signature` | `{ date, name?, issuer?, serial? }` while signing is enabled, otherwise `undefined`.         |
| `extension` | The named exports of the [extension module](#extension-module), empty without one.           |

Set the document title with `<svelte:head><title>...</title></svelte:head>`.

Components may be written in TypeScript with `<script lang="ts">`, and `.ts` modules can be imported, as `./round.js` or `./round.ts`. Svelte strips the types of components, so only type annotations are allowed there, no enums or other TypeScript that emits code; `.ts` modules take full TypeScript. Types are not checked while rendering. The built-in templates are written this way.

A template can bring its own dependencies: give the template directory a `package.json` and install it there, as the built-in templates do. Imports in components, `.ts` modules, `@import` in `<style lang="postcss">` and imported images such as `@fortawesome/fontawesome-free/svgs/solid/user.svg` resolve from the template's `node_modules` first and fall back to md-printer's own dependencies. md-printer does not install them for you; a missing one fails the build with the directory to install it in.

Styles that need Tailwind CSS v4 or package imports go into a `<style lang="postcss">` block in `Template.svelte` or any component it imports. These blocks are collected and compiled together, so they can `@import 'tailwindcss'` and use `@plugin`, `@theme` and utility classes. Plain `<style>` blocks stay scoped Svelte styles. `@import` of packages (for example `@fontsource/*`, `github-markdown-css`) resolves from the template directory first and then from md-printer's own dependencies, which cover `tailwindcss` and the highlight.js themes. The selected highlight.js theme is always included. Local `url()` and image references are inlined as data URIs.

Images are imported, which inlines them as data URIs:

```svelte
<script>
  import logo from './logo.png'
</script>

<img src={logo} alt="logo" />
```

#### Extension module

A template may contain one extension module, `src/extension.ts`, `.mts`, `.cts`, `.js`, `.mjs` or `.cjs`, so the template can bring its own functions. More than one at the default location fails the build, naming the files; to combine several modules, list them in `files.extension`.

```ts
// src/extension.ts
export function money(value: number): string {
  return `${value.toFixed(2)} EUR`
}
```

It is compiled in the same bundle as the template, so TypeScript works and its imports resolve like those of the template's own modules, from its `node_modules` first. Its named exports are available as the `extension` prop of `Template.svelte`, through the `md-printer:extension` context with `getContext`, and in any component with the `getExtension` helper:

```svelte
<script lang="ts">
  import { getExtension } from '@cenk1cenk2/md-printer/components'

  const { money } = getExtension<typeof import('../../src/extension.js')>()
</script>

<span>{money(12)}</span>
```

The default export is left out. An extension only exposes its exports, md-printer calls none of them by itself. `--preview` rebuilds when the module changes, is added or is removed.

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
| `Localized`      | Text for the language of the document from props named after languages, `<Localized en="Invoice" de="Rechnung" />` or `:localized{en="Invoice" de="Rechnung"}`, for words that need no entry in `i18n/`. Takes the language, then its base language (`de` for `de-AT`), then `fallback`, otherwise nothing. In a template a prop can also be a snippet for markup. Plain text without a wrapper element. |
| `Translate`      | Text translated with the `i18n/` directory of the template, `<Translate key="present" />` or `::translate{key="present"}`, inline as `:translate{key="present"}`. Plain text without a wrapper element. Optional `fallback` for a missing key, otherwise the key itself is printed. |
| `SignatureBlock` | Hands the signature, `{ date, name?, issuer?, serial? }`, to its `children` snippet, so the template draws the visible block with its own markup and styles. Takes the `signature` prop, or as `::signature-block` the signature of the document. Renders nothing without a signature or without `children`, so a template gives `::signature-block` its markup with its own `template/components/SignatureBlock.svelte`, see below. |

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

Every `*.svelte` file in the template's `template/components/` directory can be placed from markdown, see [Components](#components). The shared components can be placed the same way, for example `::page-break` or `::signature-block`, except `Markdown`.

A template replaces or extends any shared component, `SignatureBlock` and `Translate` included, with a file of the same name in `template/components/`:

- **Replace:** `template/components/SignatureBlock.svelte` is what `::signature-block` renders from then on. This is about directives: a component that imports `SignatureBlock` from `@cenk1cenk2/md-printer/components` keeps getting the original, so import `./components/SignatureBlock.svelte` to use the replacement in the template itself.
- **Extend:** that import always reaches md-printer's original, also from a file with the same name, so a component can wrap it:

```svelte
<!-- template/components/SignatureBlock.svelte -->
<script>
  import { SignatureBlock } from '@cenk1cenk2/md-printer/components'

  let props = $props()
</script>

<SignatureBlock {...props}>
  {#snippet children(signature)}
    <section class="my-8">
      <strong>Digitally signed</strong> by {signature.name} on {signature.date}
    </section>
  {/snippet}
</SignatureBlock>
```

```svelte
<!-- template/components/Callout.svelte -->
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
- With a certificate, the signer name, issuer and serial are passed to the template as `signature`, so the template can show who signed and when through `SignatureBlock`. The certificate must be valid at signing time, and the returned signature is rejected if it was not made with it. Without a certificate only the date is available.
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
    md|yaml|yml] [-F pdf|html] [-O] [-t <value>] [--template-type <value>]
    [--template-directory <value>] [-T <value>] [-l <value>] [-b <value>]
    [--continuous] [-p] [--host 127.0.0.1|localhost|::1] [--port <value>]
    [--open] [--sign] [--sign-provider a-trust] [--sign-certificate <value>]

ARGUMENTS
  [FILE]    Markdown or yaml file to render.
  [OUTPUT]  Output file. Overwrites the one defined in front-matter.

FLAGS
  -F, --output-filetype=<option>    Output file type, defaults to pdf.
                                    Overwrites the one defined in front-matter.
                                    <options: pdf|html>
  -I, --stdin                       Read the input from stdin.
  -O, --stdout                      Write the output to stdout instead of a
                                    file.
  -T, --title=<value>               Document title. Overwrites the one defined
                                    in front-matter or the template.
  -b, --browser=<value>             Browser executable used for printing.
                                    Discovered automatically when omitted
                                    (Brave, Chrome, Chromium, Edge).
  -f, --input-filetype=<option>     Input file type. Detected from the file
                                    extension, markdown for stdin and unknown
                                    extensions.
                                    <options: md|yaml|yml>
  -l, --language=<value>            Language for template translations.
                                    Overwrites the one defined in front-matter
                                    and template settings.
  -p, --preview                     Rebuild whenever the input, the template or
                                    its assets change, show the HTML and the PDF
                                    in a live preview and rewrite the output
                                    file when there is one.
  -t, --template=<value>            Built-in template name or path to a template
                                    directory, defaults to "default", read as
                                    --template-type when given. Overwrites the
                                    one defined in front-matter.
      --continuous                  Render the PDF as a single continuous page
                                    without page breaks.
      --host=<option>               [default: 127.0.0.1] Loopback host for the
                                    preview server, it serves the files next to
                                    the input and is never exposed to the
                                    network.
                                    <options: 127.0.0.1|localhost|::1>
      --[no-]open                   Open the preview window, --no-open keeps
                                    rebuilding and writing without one.
      --port=<value>                Port for the preview server, random when 0.
      --sign                        Sign the PDF with a qualified electronic
                                    signature through ID Austria (A-Trust).
      --sign-certificate=<value>    Signer certificate (DER or PEM) used for the
                                    visible signature block and to verify the
                                    returned signature.
      --sign-provider=<option>      Signature provider, defaults to a-trust.
                                    Overwrites the one defined in front-matter
                                    and template settings.
                                    <options: a-trust>
      --template-directory=<value>  Directory inside the package to use as the
                                    template, only valid with --template-type
                                    package.
      --template-type=<value>       How to read --template, one of builtin,
                                    package or directory, like the type of the
                                    object form in front-matter.

CLI FLAGS
  --log-level=<option>  [default: INFO, env: LOG_LEVEL] Set the log level of the
                        application.
                        <options:
                        silent|direct|fatal|error|warn|info|verbose|debug|trace>

DESCRIPTION
  Renders a markdown or yaml file through a Svelte template into a PDF or HTML
  document.
```
