<!--
  @component
  Text translated with the `i18n/` directory of the template. Plain text without a wrapper element, so it flows inside paragraphs and table cells.
-->
<script>
  import { getContext } from 'svelte'

  /** @type {{ key: string, fallback?: string }} */
  let { key, fallback } = $props()

  /** @type {import('../interfaces/template.interface.js').DocumentContext} */
  const { t } = getContext('md-printer:document')
</script>

{t(key, { defaultValue: fallback ?? key })}
