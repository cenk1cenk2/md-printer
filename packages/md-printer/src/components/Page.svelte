<!--
  @component
  Page layout: renders `children` as the document body and the `header` / `footer` snippets into the printed header and footer of every page.
-->
<script>
  import { getContext } from 'svelte'

  /** @type {{ header?: import('svelte').Snippet, footer?: import('svelte').Snippet, children?: import('svelte').Snippet }} */
  let { header, footer, children } = $props()

  const mode = getContext('md-printer:mode')
</script>

{#if mode === 'header'}
  {@render header?.()}
{:else if mode === 'footer'}
  {@render footer?.()}
{:else}
  {@render children?.()}
{/if}
