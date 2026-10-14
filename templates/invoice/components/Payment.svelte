<!--
  @component
  Bank details of the payee, shown beside the totals.
-->
<script>
  /**
   * @type {{
   *   payment: { bank?: string, address?: string, bic?: string, routing?: string, name?: string, iban?: string },
   *   t: (key: string) => string
   * }}
   */
  let { payment, t } = $props()
</script>

<div class="col-span-1 flex flex-col justify-center text-lg font-extrabold text-gray-100 bg-gray-900">
  <p class="text-vertical">{t('sections.payment')}</p>
</div>
<div class="col-span-5 flex flex-col p-4 ml-[-1px] pl-5 justify-center bg-gray-700 rounded-r-4xl text-white">
  <span>{payment.bank}</span>
  <address>{(payment.address ?? '').trim()}</address>
  <span>{payment.bic}</span>
  <span>{payment.routing}</span>
  <span class="mt-4 font-semibold">{payment.name}</span>
  <span class="font-semibold">{payment.iban}</span>
</div>
