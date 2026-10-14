<!--
  @component
  Rendered markdown body of the document as the invoice notes.
-->
<script>
  /**
   * @type {{
   *   content: string,
   *   t: (key: string) => string
   * }}
   */
  let { content, t } = $props()
</script>

<div class="col-span-1 flex flex-col justify-center text-lg font-extrabold text-gray-100">
  <p class="text-vertical">{t('sections.notes')}</p>
</div>
<div class="col-span-5 flex flex-col p-4 text-sm leading-tight prose">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown input is trusted, same as the document itself -->
  {@html content}<br />
</div>
