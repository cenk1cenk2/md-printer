<!--
  @component
  HTML document around the rendered template body.
-->
<script>
  /** @type {import('@interfaces').DocumentShellProps} */
  let { lang, title, head, body } = $props()
</script>

<html {lang}>
  <head>
    <meta charset="utf-8" />
    {#if title !== undefined}
      <title>{title}</title>
    {/if}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- styles and head elements rendered by md-printer -->
    {@html head}
  </head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- the template body rendered by md-printer -->
  <body>{@html body}</body>
</html>
