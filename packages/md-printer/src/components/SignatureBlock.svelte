<!--
  @component
  Passes the signature of a digitally signed document to the `children` snippet, which draws the block, so the template owns its markup and styles. The
  signature comes from the `signature` prop or, as a directive, from the document context. Renders nothing without a signature or without `children`.
-->
<script>
  import { getContext } from 'svelte'

  /**
   * @type {{
   *   signature?: import('../interfaces/signature.interface.js').MdPrinterSignature,
   *   children?: import('svelte').Snippet<[import('../interfaces/signature.interface.js').MdPrinterSignature]>
   * }}
   */
  let { signature = getContext('md-printer:document').signature, children } = $props()
</script>

{#if signature && children}{@render children(signature)}{/if}
