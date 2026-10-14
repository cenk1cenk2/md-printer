<!--
  @component
  Table of invoice line items with their subtotal, tax and total.
-->
<script>
  import { round } from '../round.js'

  /**
   * @type {{
   *   rows: { item: { description?: string, quantity: number, unit?: string, price: number, tax: number }, subtotal: number, tax: number, total: number }[],
   *   currency: string,
   *   t: (key: string) => string
   * }}
   */
  let { rows, currency, t } = $props()
</script>

<div class="col-span-12 px-16 py-4">
  <div class="overflow-hidden rounded-xl border-y-2 shadow-md shadow-gray-300 border-gray-900!">
    <table class="striped w-full table-auto my-0!">
      <thead class="border-b-1 border-b-gray-900! border-x-2 border-x-gray-900!">
        <tr>
          <th scope="col" class="w-md text-center">
            {t('table.description')}
          </th>
          <th scope="col" class="w-[10%] text-center">
            {t('table.quantity')}
          </th>
          <th scope="col" class="w-[10%] text-center">
            {t('table.price')}
          </th>
          <th scope="col" class="w-[10%] text-center">
            {t('table.subtotal')}
          </th>
          <th scope="col" class="w-[10%] text-center">
            {t('table.tax')}
          </th>
          <th scope="col" class="w-[14%] font-semibold text-center">
            {t('table.total')}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, index (index)}
          <tr>
            <td class="text-left align-middle">{row.item.description}</td>
            <td class="text-center align-middle">{row.item.quantity} {row.item.unit}</td>
            <td class="text-center align-middle">{row.item.price}{currency}</td>
            <td class="text-center align-middle">{round(row.subtotal)}{currency}</td>
            <td class="text-center align-middle">
              {#if row.tax > 0}
                <div class="flex flex-row items-center">
                  <span class="w-8 shrink-0 mr-1 py-px rounded-full text-center text-[0.50rem] font-semibold bg-gray-700 text-white">{row.item.tax}%</span>
                  <span>{round(row.tax)}{currency}</span>
                </div>
              {:else}
                <span class="font-semibold">—</span>
              {/if}
            </td>
            <td class="font-semibold text-right align-middle">{round(row.total)}{currency}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
