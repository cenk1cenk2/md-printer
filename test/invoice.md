---
dest: ./test/test.pdf
template: invoice
document_title: Some MD.

id: daeb87d4-a675-4867-9a95-c49b0b2aaf8a
date: 26.04.2022
currency: €

company:
  tax_number: ATU12345678
  address: |
    Straße 12/64/22
    1234 Wien
    Österreich
  phone: '+43127368'
  email: 'cenk@kilic.dev'
  website: 'https://cenk.kilic.dev'

client:
  name: Company LTD GMBH
  tax_number: ATU12345678
  address: |
    Straße 1
    1234 Stadt
    Wien/Österreich

payment:
  bank: UniCredit Bank Austria AG
  address: 1020 Wien, Rothschildplatz 1
  routing: '12000'
  bic: BKAUATWW
  iban: AT611904300234573201
  name: Cenk Kılıç

items:
  - description: Lorem ipsum dolor
    quantity: 1
    unit: month
    price: 10000
    tax: 20
  - description: Lorem ipsum dolor sit amet
    quantity: 36
    unit: days
    price: 1000
    tax: 5
  - description: Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam
    quantity: 22
    unit: items
    price: 30
    tax: 0
---

**According to the reverse charge system, tax liability transfers to the recipient of this services.**

Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.

- asdf
- asdf
