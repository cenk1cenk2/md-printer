<!--
  @component
  One course row inside `::::group`, placed as `:::course{start="November 2022" end="December 2022" duration="4 weeks" type="Full-Time"}`
  around a list of what was taught.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  import Period from './Period.svelte'
  import Pill from './Pill.svelte'

  interface Props {
    start?: string
    end?: string
    duration?: string
    type?: string
    children?: Snippet
  }

  let { start, end, duration, type, children }: Props = $props()

</script>

<div class="row course">
  <div class="label">
    <Period {start} {end} />
    {#if duration || type}
      <p class="tags">
        {#if duration}<Pill label={duration} icon="duration" />{/if}
        {#if type}<Pill label={type} />{/if}
      </p>
    {/if}
  </div>
  <div class="content">
    {@render children?.()}
  </div>
</div>

<style>
  .course {
    grid-template-columns: 50% 1fr !important;
    break-inside: avoid;
  }

  .label p {
    margin: 0;
  }

  .tags {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    gap: 0.25em;
    margin-top: 0.3em !important;
    font-style: normal;
  }
</style>
