<!--
  @component
  Footnote under a table, placed as a container, printed in italics and aligned right.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
  }

  let { children }: Props = $props()
</script>

<aside class="note">
  {@render children?.()}
</aside>

<style>
  .note {
    padding: 0.15em 0.3em;
    border-bottom: 0.5px solid var(--rule);
    font-size: 0.85em;
    color: var(--muted);
    font-style: italic;
    text-align: right;
  }
</style>
