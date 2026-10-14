<!--
  @component
  Logo, sender details and invoice title cells of the invoice header.
-->
<script>
  /**
   * @type {{
   *   company: { name?: string, tax_number?: string, address?: string, phone?: string, email?: string, website?: string },
   *   t: (key: string) => string
   * }}
   */
  let { company, t } = $props()
</script>

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
