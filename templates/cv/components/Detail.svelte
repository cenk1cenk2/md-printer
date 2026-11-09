<!--
  @component
  One personal detail inside `:::details`, placed as `::detail{label="E-Mail" value="jane@example.com" href="mailto:jane@example.com"}`.
-->
<script lang="ts">
  interface Props {
    label: string
    value: string
    href?: string
  }

  let { label, value, href }: Props = $props()
</script>

<dt>{label}</dt>
<dd>
  {#if href}
    <a {href}>{value}</a>
  {:else}
    {value}
  {/if}
</dd>

<style>
  dt,
  dd {
    margin: 0;
    padding: 0.2em 0.35em;
    border-bottom: 0.5px solid var(--rule);
    break-inside: avoid;
  }

  dt {
    grid-column: 1;
    border-right: 0.5px solid var(--rule);
    color: var(--muted);
    text-align: center;
  }

  dd {
    grid-column: span 3;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
</style>
