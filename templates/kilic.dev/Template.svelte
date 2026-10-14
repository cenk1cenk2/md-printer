<script>
  import { Markdown, Page, PageNumber, Title, TotalPages } from '@cenk1cenk2/md-printer/components'

  let { data } = $props()

  const logo = 'https://main.s3.kilic.dev/html/icon.png'
</script>

<svelte:head>
  {#if data.documentTitle}
    <title>{data.documentTitle}</title>
  {/if}
</svelte:head>

<Page>
  {#snippet header()}
    <header style="margin: 0 auto; text-align: center; font-family: monospace; color: #242424">
      <img height="24" src={logo} alt="logo" />
    </header>
  {/snippet}

  {#snippet footer()}
    <footer style="margin: 0 auto; text-align: center; font-size: 8px; color: #38404b; width: 100%; border-top: 1px solid #efefef; padding-top: 8px">
      <img height="8" src={logo} alt="logo" />
      <span>kilic.dev</span>
      -
      <Title />
      -
      <PageNumber />/<TotalPages />
    </footer>
  {/snippet}

  <Markdown />
</Page>

<style lang="postcss">
  @import 'github-markdown-css/github-markdown-light.css';
  @import '@fontsource/montserrat/latin-400.css';
  @import '@fontsource/montserrat/latin-ext-400.css';
  @import '@fontsource/montserrat/latin-700.css';
  @import '@fontsource/montserrat/latin-ext-700.css';
  @import '@fontsource/montserrat/latin-800.css';
  @import '@fontsource/montserrat/latin-ext-800.css';

  .markdown-body {
    font-size: 11px;
    font-family: 'Montserrat', sans-serif;
  }

  .markdown-body h1,
  .markdown-body h2 {
    font-weight: 800;
  }

  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6,
  .markdown-body strong,
  .markdown-body b {
    font-weight: 700;
  }

  .markdown-body pre > code {
    white-space: pre-wrap;
    padding: 0;
    margin: 0;
  }

  .markdown-body .document-title-header {
    height: 500px;
    margin: auto auto;
    padding-top: 50%;
    break-after: page;
    border-bottom: 0;
    font-size: 2.5em;
  }

  .markdown-body pre {
    padding: 12px 8px;
  }

  .markdown-body output pre {
    margin-top: -36px;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: 2px solid #d1d9e0;
  }

  .markdown-body output::before {
    padding: 4px 16px;
    position: relative;
    top: -24px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    border-top: 2px solid #d1d9e0;
    color: #59636e;
    background-color: #f6f8fa;
    content: '> output';
    font-size: 0.85em;
  }
</style>
