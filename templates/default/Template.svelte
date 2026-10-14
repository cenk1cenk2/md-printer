<script>
  import { Markdown, Page } from '@cenk1cenk2/md-printer/components'

  let { data, content } = $props()
</script>

<svelte:head>
  {#if data.document_title}
    <title>{data.document_title}</title>
  {/if}
</svelte:head>

<Page>
  <Markdown {content} />
</Page>
