<!--
  @component
  Table of spoken languages, placed as a container around `::language` leaves.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
  }

  let { children }: Props = $props()
</script>

<div class="languages">
  {@render children?.()}
</div>

<style>
  .languages {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    break-inside: avoid;
  }
</style>
