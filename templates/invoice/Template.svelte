<script>
  import { Page, PageNumber, TotalPages, Title, SignatureBlock } from '@cenk1cenk2/md-printer/components'

  let { data, content, t, signature } = $props()

  const { company = {}, client = {}, payment = {}, currency = '', date, id } = $derived(data)

  // nunjucks `round(2)`: Math.round(x * 100) / 100, printed without trailing zeros
  const round = (value) => Math.round(Number(value) * 100) / 100

  const rows = $derived.by(() =>
    (data.items ?? []).map((item) => {
      const subtotal = item.quantity * item.price
      const tax = (subtotal * item.tax) / 100

      return {
        item,
        subtotal,
        tax,
        total: subtotal + tax
      }
    })
  )
  const calculatedSubtotal = $derived(rows.reduce((sum, row) => sum + row.subtotal, 0))
  const calculatedTax = $derived(rows.reduce((sum, row) => sum + row.tax, 0))
  const calculatedTotal = $derived(calculatedSubtotal + calculatedTax)

  const title = $derived(
    `${date} - Invoice from ${company.name}${company.tax_number ? ` (${company.tax_number})` : ''} to ${client.name}${client.tax_number ? ` (${client.tax_number})` : ''} - #${id}`
  )
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<Page>
  {#snippet footer()}
    <div style="margin: 0 auto; text-align: center; font-size: 8px; color: #38404b; width: 100%; padding-top: 8px; margin-bottom: -8px;">
      <Title />
      -
      <b> <PageNumber />/<TotalPages /> </b>
    </div>
  {/snippet}

  <div class="max-w-full leading-tight prose grid">
    <section id="header" class="relative grid grid-cols-12">
      <img
        src="https://main.s3.kilic.dev/html/icon.png"
        alt="logo"
        class="absolute h-40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] drop-shadow-lg drop-shadow-gray-900 z-10"
      />
      <div class="col-span-1 flex flex-col justify-center text-lg font-extrabold text-gray-100">
        <p class="text-vertical">{t('sections.from')}</p>
      </div>
      <div class="col-start-2 col-span-5 flex flex-col justify-start p-4 pt-10 mr-12">
        <h1>{company.name}</h1>
        <h3>{company.tax_number}</h3>
        <address>{(company.address ?? '').trim()}</address>
        <div class="flex flex-col text-sm">
          {#if company.phone}
            <a href="tel:{company.phone}">{company.phone}</a>
          {/if}
          {#if company.email}
            <a href="mailto:{company.email}">{company.email}</a>
          {/if}
          {#if company.website}
            <a href={company.website}>{company.website}</a>
          {/if}
        </div>
      </div>
      <div class="col-span-6 bg-gray-900 rounded-bl-4xl flex flex-col justify-center text-center">
        <p class="p-4 font-bold text-white text-6xl">{t('invoice')}</p>
      </div>
    </section>
    <section id="client" class="grid grid-cols-12">
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
    </section>
    <section id="items" class="grid grid-cols-12">
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
    </section>
    <section id="payment" class="grid grid-cols-12">
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
      <div class="col-span-1"></div>
      <div class="col-span-5 flex flex-col justify-center m-8 mr-16">
        <div class="w-full overflow-hidden rounded-xl border-y-2 shadow-md shadow-gray-300 border-gray-900!">
          <table class="w-full table-auto my-0!">
            <tbody>
              <tr>
                <td class="w-[55%] text-left align-middle font-semibold">{t('summary.subtotal')}</td>
                <td class="w-[45%] text-right align-middle font-semibold">{round(calculatedSubtotal)}{currency}</td>
              </tr>
              <tr>
                <td class="w-[55%] text-left align-middle font-semibold border-t! border-t-gray-100/30!">{t('summary.tax')}</td>
                <td class="w-[45%] text-right align-middle font-semibold border-t! border-t-gray-100/30!">
                  {#if calculatedTax > 0}
                    {round(calculatedTax)}{currency}
                  {:else}
                    —
                  {/if}
                </td>
              </tr>
              <tr>
                <td class="w-[55%] text-left align-middle font-bold text-primary-500 border-t-2! border-t-primary-500!">{t('summary.total')}</td>
                <td class="w-[45%] text-right align-middle font-bold text-primary-500 border-t-2! border-t-primary-500!">
                  {round(calculatedTotal)}{currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section id="footer" class="grid grid-cols-12">
      <div class="col-span-1 flex flex-col justify-center text-lg font-extrabold text-gray-100">
        <p class="text-vertical">{t('sections.notes')}</p>
      </div>
      <div class="col-span-5 flex flex-col p-4 text-sm leading-tight prose">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown input is trusted, same as the document itself -->
        {@html content}<br />
      </div>
      <div class="col-span-1"></div>
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
    </section>
  </div>
</Page>
