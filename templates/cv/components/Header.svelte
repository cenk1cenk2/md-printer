<!--
  @component
  Name, titles and photo of the CV from the front-matter, closed by the document heading. The template places it.
-->
<script lang="ts">
  import type { TFunction } from 'i18next'
  import { getContext } from 'svelte'

  const { data, t } = getContext<{
    data: { name?: string, suffix?: string, title?: string, tagline?: string[], photo?: string, heading?: string }
    t: TFunction
  }>('md-printer:document')

  const lines = $derived([data.title, ...(data.tagline ?? [])].filter(Boolean))
</script>

<header class="header">
  <div class="identity">
    <h1>{data.name}{#if data.suffix}, {data.suffix}{/if}</h1>
    {#each lines as line, index (index)}
      <p>{line}</p>
    {/each}
  </div>
  {#if data.photo}
    <img class="photo" src={data.photo} alt={data.name} />
  {/if}
</header>
<p class="heading">{data.heading ?? t('resume')}</p>

<style>
  .header {
    display: grid;
    grid-template-columns: 1fr 20%;
    border-bottom: 1.25px solid var(--ink);
  }

  .identity {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 1.5em 0;
    text-align: center;
  }

  .identity h1 {
    margin: 0 0 0.45em;
    font-size: 2.05em;
    font-weight: 700;
    letter-spacing: 0.015em;
  }

  .identity p {
    margin: 0;
    font-size: 1.08em;
    line-height: 1.4;
    font-style: italic;
    color: var(--ink);
  }

  .identity h1 + p {
    margin-bottom: 0.15em;
    font-style: normal;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.95em;
    color: var(--ink);
  }

  .photo {
    display: block;
    width: 100%;
    aspect-ratio: 5 / 6;
    object-fit: cover;
    border-left: 0.5px solid var(--rule);
    padding-left: 0.5em;
  }

  .heading {
    margin: 0;
    padding: 0.22em 0;
    border-bottom: 0.5px solid var(--rule);
    font-weight: 700;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    text-align: center;
  }
</style>
