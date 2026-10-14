<!--
  @component
  Subtotal, tax and total summary of the invoice.
-->
<script>
  import { round } from '../round.js'

  /**
   * @type {{
   *   subtotal: number,
   *   tax: number,
   *   total: number,
   *   currency: string,
   *   t: (key: string) => string
   * }}
   */
  let { subtotal, tax, total, currency, t } = $props()
</script>

<div class="col-span-5 flex flex-col justify-center m-8 mr-16">
  <div class="w-full overflow-hidden rounded-xl border-y-2 shadow-md shadow-gray-300 border-gray-900!">
    <table class="w-full table-auto my-0!">
      <tbody>
        <tr>
          <td class="w-[55%] text-left align-middle font-semibold">{t('summary.subtotal')}</td>
          <td class="w-[45%] text-right align-middle font-semibold">{round(subtotal)}{currency}</td>
        </tr>
        <tr>
          <td class="w-[55%] text-left align-middle font-semibold border-t! border-t-gray-100/30!">{t('summary.tax')}</td>
          <td class="w-[45%] text-right align-middle font-semibold border-t! border-t-gray-100/30!">
            {#if tax > 0}
              {round(tax)}{currency}
            {:else}
              —
            {/if}
          </td>
        </tr>
        <tr>
          <td class="w-[55%] text-left align-middle font-bold text-primary-500 border-t-2! border-t-primary-500!">{t('summary.total')}</td>
          <td class="w-[45%] text-right align-middle font-bold text-primary-500 border-t-2! border-t-primary-500!">
            {round(total)}{currency}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
