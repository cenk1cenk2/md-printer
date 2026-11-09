<!--
  @component
  Period of an entry or a course, stacked under a calendar icon as end, dash and start. A single date prints alone.
  Used by `:::entry` and `:::course`; `::period{start="March 2024" end="present"}` places one in markdown.
-->
<script lang="ts">
  import { tags } from '../icons.js'

  interface Props {
    start?: string
    end?: string
  }

  let { start, end }: Props = $props()
</script>

<p class="period">
  <img src={tags.period} alt="" aria-hidden="true" />
  {#if start && end && start !== end}
    <span class="date">{end}</span>
    <span class="dash">–</span>
    <span class="date">{start}</span>
  {:else}
    <span class="date">{end ?? start}</span>
  {/if}
</p>

<style>
  .period {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    font-weight: 700;
    line-height: 1.25;
  }

  img {
    height: 0.9em;
    width: 1em;
    margin-bottom: 0.15em;
    object-fit: contain;
    opacity: 0.75;
  }

  .date {
    white-space: nowrap;
  }

  .dash {
    font-weight: 400;
    color: var(--muted);
  }
</style>
