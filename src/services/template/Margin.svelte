<!--
  @component
  Wrapper for a header or footer snippet printed into Chrome's isolated page margin, which ignores the page stylesheet and defaults to a tiny font.
-->
<script>
  /** @type {import('@interfaces').MarginShellProps} */
  let { styles, body } = $props()
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- styles collected by md-printer for the isolated margin document -->
{@html styles}
<div style="font-size: 10px; width: 100%; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- the header or footer snippet rendered by md-printer -->
  {@html body}
</div>
