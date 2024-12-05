---
dest: ./test/test.pdf
template: privat-rechnung
document_title: test rechnung

id: 123-123-123123-12321312
date: 26.04.2022
location: Wien/Österreich
currency: €

sender:
  name: Eenk Kilic
  address: yat
  postcode: 123
  location: Wien/Österreich
  phone: '+43127368'
  email: 'cenk@kilic.dev'

receiver:
  name: Cenk Kilic
  address: yat
  postcode: 123
  location: Wien/Österreich
  phone: '+43127368'

payment:
  name: Cenk
  bank: ba
  bic: qwe
  iban: ATasdqwe

items:
  - description: test
    quantity: 1
    type: day
    price: 3

  - description: test
    quantity: 1
    type: day
    price: 3

  - description: test
    quantity: 1
    type: day
    price: 3
---

some notes
