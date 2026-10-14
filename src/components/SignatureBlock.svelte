<!--
  @component
  Visible block for a digitally signed document, filled from the `signature` prop md-printer passes to templates when signing is enabled.
  Styled with Tailwind classes, so the template needs a `style.css` importing Tailwind.
-->
<script>
  /**
   * @type {{
   *   signature: { date: string, name?: string, issuer?: string, serial?: string },
   *   labels?: { title?: string, by?: string, date?: string, issuer?: string, verify?: string },
   *   class?: string
   * }}
   */
  let { signature, labels = {}, class: className = '' } = $props()

  const text = $derived({
    title: 'Digitally signed',
    by: 'Signed by',
    date: 'Date',
    issuer: 'Certificate',
    verify: 'This document carries a qualified electronic signature. Verify it at',
    ...labels
  })
</script>

<div class="w-full overflow-hidden rounded-xl border-y-2 shadow-md shadow-gray-300 border-gray-900! text-xs {className}">
  <div class="flex items-center gap-3 px-5 py-3 bg-gray-900 text-white">
    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
    <span class="font-extrabold uppercase tracking-wider">{text.title}</span>
  </div>
  <div class="flex flex-col px-5 py-2">
    {#if signature.name}
      <div class="flex justify-between gap-4 py-2">
        <span class="font-semibold text-gray-400">{text.by}</span>
        <span class="font-semibold text-right">{signature.name}</span>
      </div>
    {/if}
    <div class="flex justify-between gap-4 py-2 border-t border-t-gray-100/30">
      <span class="font-semibold text-gray-400">{text.date}</span>
      <span class="text-right">{signature.date}</span>
    </div>
    {#if signature.issuer}
      <div class="flex justify-between gap-4 py-2 border-t border-t-gray-100/30">
        <span class="font-semibold text-gray-400">{text.issuer}</span>
        <span class="text-right text-[0.6rem]">{signature.issuer} · {signature.serial}</span>
      </div>
    {/if}
  </div>
  <p class="px-5 py-3 bg-gray-50 text-[0.6rem] text-gray-400 leading-snug">
    {text.verify}
    <a href="https://www.signaturpruefung.gv.at" class="font-semibold text-gray-900 underline">signaturpruefung.gv.at</a>
  </p>
</div>
