<!--
  @component
  Several courses or engagements at one institution, placed as a container around `:::course` rows:

  ::::group{name="School" location="City, Country" role="Lecturer"}
  :::course{start="March 2023" duration="2 weeks" type="Full-Time"}
  - Course
  :::
  ::::
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    name: string
    location?: string
    role?: string
    website?: string
    logo?: string
    children?: Snippet
  }

  let { name, location, role, website, logo, children }: Props = $props()
</script>

<section class="group">
  <div class="title">
    {#if logo}<img class="logo" src={logo} alt="" aria-hidden="true" />{/if}
    <div class="text">
      <h3>{#if website}<a href={website}>{name}</a>{:else}{name}{/if}{#if location}, {location}{/if}</h3>
      {#if role}
        <p>{role}</p>
      {/if}
    </div>
  </div>
  {@render children?.()}
</section>

<style>
  /* the logo sits beside the name and the role, as tall as both lines */
  .title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    padding: 0.2em 0;
    border-bottom: 0.5px solid var(--rule);
    text-align: center;
    break-after: avoid;
    break-inside: avoid;
  }

  h3 {
    margin: 0;
    font-weight: 700;
  }

  .logo {
    width: 2.8em;
    height: 2.8em;
    background: #fff;
    object-fit: contain;
  }

  p {
    margin: 0.15em 0 0;
    padding: 0;
    text-decoration: underline;
    text-decoration-thickness: 0.5px;
    text-underline-offset: 0.18em;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
</style>
