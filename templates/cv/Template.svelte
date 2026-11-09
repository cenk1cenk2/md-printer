<script lang="ts">
  import Header from './components/Header.svelte'
  import { Markdown, Page, PageNumber } from '@cenk1cenk2/md-printer/components'

  interface Props {
    data: { documentTitle?: string, name?: string, title?: string }
  }

  let { data }: Props = $props()

  const title = $derived(data.documentTitle ?? [data.name, data.title].filter(Boolean).join(' - '))
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<Page>
  {#snippet footer()}
    <div style="width: 100%; margin-right: 22mm; text-align: right; font-family: 'Carlito', 'Calibri', sans-serif; font-size: 9pt;">
      <PageNumber />
    </div>
  {/snippet}

  <main class="cv">
    <Header />
    <Markdown />
  </main>
</Page>

<style lang="postcss">
  @import '@fontsource/carlito/latin-400.css';
  @import '@fontsource/carlito/latin-ext-400.css';
  @import '@fontsource/carlito/latin-400-italic.css';
  @import '@fontsource/carlito/latin-ext-400-italic.css';
  @import '@fontsource/carlito/latin-700.css';
  @import '@fontsource/carlito/latin-ext-700.css';
  @import '@fontsource/carlito/latin-700-italic.css';
  @import '@fontsource/carlito/latin-ext-700-italic.css';

  *,
  ::before,
  ::after {
    box-sizing: border-box;
  }

  :root {
    --ink: #000;
    --muted: #333;
    --rule: #444;
    --frame: #888;
    --accent: #000;
    --tint: #fff;
    --tint-strong: #fff;
  }

  html {
    font-size: 11pt;
  }

  body {
    margin: 0;
    font-family: 'Carlito', 'Calibri', sans-serif;
    line-height: 1.3;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    text-rendering: optimizeLegibility;
  }

  .cv a {
    color: inherit;
    text-decoration: none;
  }

  .cv h1,
  .cv h2,
  .cv h3,
  .cv p,
  .cv ul {
    margin: 0;
    padding: 0;
    font-size: inherit;
  }

  .cv .markdown-body > p {
    margin: 0.3em 0;
  }

  /* rows: a label column and a content column, divided by a vertical rule */
  .cv .row {
    display: grid;
    grid-template-columns: 21.5% 1fr;
    border-bottom: 0.5px solid var(--rule);
  }

  .cv .row > .label {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 0.25em 0.35em;
    border-right: 0.5px solid var(--rule);
    text-align: center;
  }

  .cv .row > .content {
    padding: 0.25em 0.45em;
  }

  /* lists in entries and courses print as en dash lines, like the original document */
  .cv .content ul {
    list-style: none;
  }

  .cv .entry .content li,
  .cv .course .content li {
    padding-left: 0.85em;
    text-indent: -0.85em;
  }

  .cv .entry .content li + li {
    margin-top: 0.12em;
  }

  .cv .content li::before {
    content: '– ';
    color: var(--muted);
  }

  .cv .entry .content ul {
    font-size: 0.82em;
    line-height: 1.28;
    margin: 0.3em 0 0.15em;
  }

  .cv .entry .content p {
    margin: 0.25em 0;
    font-style: italic;
  }

  /* the summary under the role prints as a quote */
  .cv .entry:not(.compact) .content p:not(.role) {
    margin: 0.35em 0 0.3em;
    padding: 0.05em 0 0.05em 0.6em;
    border-left: 2px solid var(--accent);
    font-size: 0.9em;
    line-height: 1.32;
    font-style: italic;
    color: var(--muted);
  }

  .cv .pill {
    display: inline-block;
    padding: 0.05em 0.3em;
    background: var(--tint);
    font-size: 0.85em;
    font-style: normal;
  }

  .cv .entry .content h3,
  .cv .entry .content .role {
    break-after: avoid;
  }

  .cv .entry:not(.compact) .content p:not(.role),
  .cv .entry .content li {
    break-inside: avoid;
  }

  .cv .entry.compact {
    break-inside: avoid;
  }

  .cv .entry.compact .content p {
    font-size: 0.9em;
    font-style: normal;
  }

  .page-break {
    page-break-after: always;
  }
</style>
