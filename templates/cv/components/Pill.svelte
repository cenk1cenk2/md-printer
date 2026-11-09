<!--
  @component
  Rounded tag with an optional icon, used for employment types, attendance and durations. `::pill{label="Remote"}` places one in
  markdown; the icon is looked up from the label unless `icon` names a key of `tags` in `icons.ts`.
-->
<script lang="ts">
  import { tags } from '../icons.js'

  interface Props {
    label: string
    icon?: string
  }

  let { label, icon }: Props = $props()

  const src = $derived(tags[(icon ?? label).toLowerCase()])
</script>

<span class="pill">
  {#if src}
    <img {src} alt="" aria-hidden="true" />
  {/if}
  {label}
</span>

<style>
  img {
    height: 0.8em;
    width: 0.9em;
    margin-right: 0.15em;
    object-fit: contain;
    opacity: 0.75;
    vertical-align: -0.05em;
  }
</style>
