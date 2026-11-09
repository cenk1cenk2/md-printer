<!--
  @component
  Two `::detail` leaves sharing one row of `:::details`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
  }

  let { children }: Props = $props()
</script>

<div class="pair">
  {@render children?.()}
</div>

<style>
  .pair {
    display: contents;
  }

  .pair :global(dd) {
    grid-column: span 1;
  }

  .pair :global(dt:nth-of-type(2)) {
    grid-column: auto;
    border-left: 0.5px solid var(--rule);
    font-style: normal;
    text-align: left;
  }
</style>
