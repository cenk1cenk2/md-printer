<!--
  @component
  One job, internship or degree as a table row, placed as a container:

  :::entry{start="March 2024" end="present" name="Company" location="City, Country" role="Role" type="Full-Time" note="Remote" logo="./assets/company.png"}
  Summary paragraph, printed as an italic quote. The location prints as a pill under the dates.

  - Highlights, printed as dash lines.
  :::

  The period prints stacked under a calendar icon, newest first, and `end="present"` prints the translated "present". `compact` prints the role without
  underline, as for degrees.
-->
<script lang="ts">
  import type { TFunction } from 'i18next'
  import type { Snippet } from 'svelte'
  import { getContext } from 'svelte'

  import Period from './Period.svelte'
  import Pill from './Pill.svelte'

  interface Props {
    start?: string
    end?: string
    name: string
    location?: string
    role?: string
    type?: string
    note?: string
    website?: string
    logo?: string
    compact?: string
    children?: Snippet
  }

  let { start, end, name, location, role, type, note, website, logo, compact, children }: Props = $props()

  const { t } = getContext<{ t: TFunction }>('md-printer:document')

  const until = $derived(end === 'present' ? t('present') : end)
  const isCompact = $derived(compact !== undefined)
</script>

<section class="row entry" class:compact={isCompact}>
  <div class="label">
    {#if logo}
      <img class="logo" src={logo} alt="" aria-hidden="true" />
    {/if}
    <Period {start} end={until} />
    {#if type || note || location}
      <p class="tags">
        {#if type}<Pill label={type} />{/if}
        {#if note}<Pill label={note} />{/if}
        {#if location}<Pill label={location} icon="location" />{/if}
      </p>
    {/if}
  </div>
  <div class="content">
    <h3>
      {#if website}<a href={website}>{name}</a>{:else}{name}{/if}
    </h3>
    {#if role}
      <p class="role" class:underline={!isCompact}>{role}</p>
    {/if}
    {@render children?.()}
  </div>
</section>

<style>
  .label p {
    margin: 0;
  }

  .logo {
    display: block;
    width: 4em;
    height: 4em;
    margin: 0 auto 0.45em;
    background: #fff;
    object-fit: contain;
  }

  .tags {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    gap: 0.25em;
    margin-top: 0.4em !important;
    font-style: normal;
  }

  h3 {
    margin: 0;
    font-weight: 700;
  }

  h3 {
    letter-spacing: 0.01em;
  }

  .role {
    margin: 0.1em 0 0;
    font-style: normal !important;
    font-size: 1em !important;
  }

  .underline {
    text-decoration: underline;
    text-decoration-thickness: 0.5px;
    text-underline-offset: 0.18em;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
</style>
