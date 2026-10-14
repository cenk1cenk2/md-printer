<script>
  import logo from './logo.png'
  import { Markdown, Page, PageNumber, Title, TotalPages } from '@cenk1cenk2/md-printer/components'

  let { data, content } = $props()
</script>

<svelte:head>
  {#if data.document_title}
    <title>{data.document_title}</title>
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

  <Markdown {content} />
</Page>
