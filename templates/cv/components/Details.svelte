<!--
  @component
  Table of personal details, placed as a container around `::detail` rows. `:::pair` puts two details on one row, the outer fence takes more colons:

  ::::details
  ::detail{label="Address" value="Street 1, City"}

  :::pair
  ::detail{label="E-Mail" value="jane@example.com" href="mailto:jane@example.com"}
  ::detail{label="Web Site" value="https://example.com" href="https://example.com"}
  :::
  ::::
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
  }

  let { children }: Props = $props()
</script>

<dl class="details">
  {@render children?.()}
</dl>

<style>
  .details {
    display: grid;
    grid-template-columns: 21.5% 1fr 1fr 1fr;
    margin: 0;
  }
</style>
