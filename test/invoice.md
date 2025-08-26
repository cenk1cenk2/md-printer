---
dest: ./test/test.pdf
template: invoice

id: daeb87d4-a675-4867-9a95-c49b0b2aaf8a
date: 26.04.2022
currency: €

company:
  tax_number: ATU12345678
  address: |
    Straße 1
    1234 Stadt
    Wien/Österreich
  phone: '+43127368'
  email: 'cenk@kilic.dev'
  website: 'https://cenk.kilic.dev'

tax:
  rate: 0

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
  - description: test
    quantity: 1
    type: day
    price: 3
  - description: test
    quantity: 1
    type: day
    price: 3
---

Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.

- asdf
- asdf
