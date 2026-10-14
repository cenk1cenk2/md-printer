<script>
  import { Page } from '@cenk1cenk2/md-printer/components'

  let { content } = $props()
</script>

<svelte:head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="UTF-8" />
</svelte:head>

<Page>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown input is trusted, same as the document itself -->
  <div class="leading-tight prose">{@html content}</div>
</Page>
