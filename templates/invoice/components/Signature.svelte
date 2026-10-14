<!--
  @component
  Signature block of the invoice: the digital signature when signing is enabled, an empty box otherwise.
-->
<script>
  import { SignatureBlock } from '@cenk1cenk2/md-printer/components'

  /**
   * @type {{
   *   signature?: { date: string, name?: string, issuer?: string, serial?: string },
   *   t: (key: string) => string
   * }}
   */
  let { signature, t } = $props()
</script>

{#if signature}
  <div class="col-span-5 flex flex-col justify-center m-8 mr-16">
    <SignatureBlock
      {signature}
      labels={{
        title: t('signed.title'),
        by: t('signed.by'),
        date: t('signed.date'),
        issuer: t('signed.issuer'),
        verify: t('signed.verify')
      }}
    />
  </div>
{:else}
  <div class="col-span-5 flex flex-col justify-end text-center m-8 mr-16 p-4 pb-0 border-2 border-gray-50! rounded-xl text-xs text-gray-100 h-36">
    <p>{t('signature')}</p>
  </div>
{/if}
