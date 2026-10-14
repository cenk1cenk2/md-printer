<!--
  @component
  Rendered markdown content, styled by github-markdown-css when the template imports it.
-->
<script>
  /** @type {{ content: string, class?: string }} */
  let { content, class: className = '' } = $props()
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown input is trusted, same as the document itself -->
<article class="markdown-body {className}">{@html content}</article>

<style>
  :global(.page-break) {
    break-after: page;
  }
</style>
