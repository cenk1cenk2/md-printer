<!--
  @component
  Section heading with an icon, placed as `::section{title="Work Experience" icon="work"}`. The rows following it belong to it.
  Icons: contact, profile, work, teaching, education, skills, languages.
-->
<script lang="ts">
  import { sections as icons } from '../icons.js'

  interface Props {
    title: string
    icon?: string
  }

  let { title, icon }: Props = $props()

  if (icon && !icons[icon]) {
    throw new Error(`Unknown section icon "${icon}", use one of ${Object.keys(icons).join(', ')}.`)
  }
</script>

<h2 class="section">
  {#if icon}
    <span class="icon" style:mask-image="url({icons[icon]})" aria-hidden="true"></span>
  {/if}
  {title}
</h2>

<style>
  .section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3em;
    margin: 1.4em 0 0;
    padding: 0.15em 0.3em;
    border-top: 1.25px solid var(--ink);
    border-bottom: 0.5px solid var(--rule);
    color: var(--accent);
    font-size: 0.95em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    break-after: avoid;
  }

  .icon {
    height: 1em;
    width: 1.1em;
    background-color: currentColor;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style>
