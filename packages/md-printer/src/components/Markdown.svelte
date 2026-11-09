<!--
  @component
  The markdown document, with directives rendered as components. Styled by github-markdown-css when the template imports it.
-->
<script>
  import { getContext } from 'svelte'

  import Nodes from './Nodes.svelte'

  /** @type {{ class?: string }} */
  let { class: className = '' } = $props()
</script>

<article class="markdown-body {className}"><Nodes nodes={getContext('md-printer:markdown')} /></article>

<style>
  :global(.page-break) {
    break-after: page;
  }
</style>
