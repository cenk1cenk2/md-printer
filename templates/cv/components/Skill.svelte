<!--
  @component
  One row of skills, placed as `::skill{name="Monitoring" items="Grafana: Prometheus, Mimir, Loki | ElasticSearch"}`. Items are separated
  by `|` and print as pills; `Umbrella: a, b, c` prints an umbrella pill holding a pill for each of a, b and c.
-->
<script lang="ts">
  interface Props {
    name: string
    items?: string
  }

  interface Item {
    label: string
    children: string[]
  }

  let { name, items = '' }: Props = $props()

  const list = $derived(
    items
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item): Item => {
        const [label, children] = item.split(/:(.*)/s)

        return children === undefined
          ? { label: item, children: [] }
          : {
            label: label.trim(),
            children: children
              .split(',')
              .map((child) => child.trim())
              .filter(Boolean)
          }
      })
  )
</script>

<div class="row skill">
  <p class="label">{name}</p>
  <ul class="content">
    {#each list as item (item.label)}
      {#if item.children.length}
        <li class="pill umbrella">
          <span class="umbrella-label">{item.label}</span>
          <ul>
            {#each item.children as child (child)}
              <li class="pill">{child}</li>
            {/each}
          </ul>
        </li>
      {:else}
        <li class="pill">{item.label}</li>
      {/if}
    {/each}
  </ul>
</div>

<style>
  .skill {
    break-inside: avoid;
  }

  .label {
    margin: 0;
    font-size: 0.95em;
    color: var(--muted);
  }

  .content {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    align-items: center;
    gap: 0.25em;
    margin: 0;
    padding: 0.3em !important;
    list-style: none;
  }

  li::before {
    content: none !important;
  }

  .umbrella {
    display: inline-flex;
    flex-flow: row wrap;
    align-items: center;
    gap: 0.25em;
    padding: 0.15em 0.2em 0.15em 0.45em;
    background: var(--tint-strong);
  }

  .umbrella-label {
    font-weight: 700;
  }

  .umbrella ul {
    display: inline-flex;
    flex-flow: row wrap;
    gap: 0.25em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .umbrella .pill {
    font-size: 1em;
    background: #fff;
  }
</style>
