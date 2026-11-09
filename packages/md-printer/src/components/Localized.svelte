<!--
  @component
  Text picked by the language of the document from props named after languages, such as `en` and `de`, for words that need no entry in `i18n/`. Takes the
  language as it is, then its base language, then `fallback`. In a template a prop can also be a snippet. Plain text without a wrapper element, like Translate.
-->
<script>
  import { getContext } from 'svelte'

  /** @type {{ fallback?: string | import('svelte').Snippet } & Record<string, string | import('svelte').Snippet | undefined>} */
  let { fallback, ...languages } = $props()

  /** @type {import('../interfaces/template.interface.js').DocumentContext} */
  const { language } = getContext('md-printer:document')

  const value = $derived(languages[language] ?? languages[language.split('-')[0]] ?? fallback)
</script>

{#if typeof value === 'function'}{@render value()}{:else}{value ?? ''}{/if}
