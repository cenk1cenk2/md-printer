<!--
  @component
  Recipient details and the date/id table of the invoice.
-->
<script>
  /**
   * @type {{
   *   client: { name?: string, tax_number?: string, address?: string },
   *   date: string,
   *   id: string | number,
   *   t: (key: string) => string
   * }}
   */
  let { client, date, id, t } = $props()
</script>

<div class="col-span-1 flex flex-col justify-center text-lg font-extrabold text-gray-100">
  <p class="text-vertical">{t('sections.to')}</p>
</div>
<div class="col-span-5 flex flex-col justify-start p-4">
  <h2>{client.name}</h2>
  {#if client.tax_number}
    <h3>{client.tax_number}</h3>
  {/if}
  <address>{(client.address ?? '').trim()}</address>
</div>
<div class="col-span-6 flex items-center justify-center text-xs py-4 pl-4 pr-16">
  <div class="w-full overflow-hidden rounded-xl border-y-2 shadow-md shadow-gray-300 border-gray-900!">
    <table class="w-full table-auto my-0!">
      <tbody>
        <tr>
          <td class="w-[30%] text-left align-middle font-bold">{t('fields.date')}</td>
          <td class="w-[70%] text-right align-middle font-semibold">{date}</td>
        </tr>
        <tr>
          <td class="w-[30%] text-left align-middle font-bold border-t! border-t-gray-100/30!">{t('fields.id')}</td>
          <td class="w-[70%] text-right align-middle font-semibold border-t! border-t-gray-100/30!">{id}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
