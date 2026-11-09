<!--
  @component
  One spoken language, placed as `::language{name="English" level="Fluent"}` inside `:::languages`.
-->
<script lang="ts">
  interface Props {
    name: string
    level?: string
  }

  let { name, level }: Props = $props()
</script>

<dl class="language">
  <dt>{name}</dt>
  <dd>{level}</dd>
</dl>

<style>
  .language {
    margin: 0;
    text-align: center;
  }

  .language + :global(.language) {
    border-left: 0.5px solid var(--rule);
  }

  dt,
  dd {
    margin: 0;
    padding: 0.3em;
    border-bottom: 0.5px solid var(--rule);
  }

  dt {
    font-weight: 700;
  }
</style>
