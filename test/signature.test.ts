import type { X509Certificate } from 'crypto'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Identity, SignOptions } from './signature.fixtures.js'
import { document, identity, sign } from './signature.fixtures.js'
import type { SignatureRequest } from '@interfaces'
import type { ATrustAdapter } from '@services'
import { SignatureService } from '@services'

describe('SignatureService', () => {
  let pdf: Buffer
  let returned: Buffer
  let alice: Identity
  let bob: Identity

  function service(signer: Identity, options?: SignOptions): SignatureService {
    return new SignatureService({
      name: 'test',
      sign: async({ pdf, excluded: [from, to] }: SignatureRequest): Promise<Buffer> => {
        returned = await sign(new Uint8Array(Buffer.concat([pdf.subarray(0, from), pdf.subarray(to + 1)])).buffer, signer, options)

        return returned
      }
    } as unknown as ATrustAdapter)
  }

  beforeAll(async() => {
    pdf = document()
    alice = await identity('Alice', 1, { name: 'ECDSA', namedCurve: 'P-256' })
    bob = await identity('Bob', 2, {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    })
  })

  it.each([
    ['ECDSA', (): Identity => alice],
    ['RSA', (): Identity => bob]
  ])('embeds a %s signature over the document from the configured certificate', async(_, signer) => {
    const signed = await service(signer()).sign(pdf, { date: new Date(), certificate: signer().x509 })

    expect(signed.toString('latin1')).toContain(`/Contents <${returned.toString('hex')}0`)
  })

  it('accepts a valid signature without a configured certificate', async() => {
    await expect(service(alice).sign(pdf, { date: new Date() })).resolves.toBeInstanceOf(Buffer)
  })

  it.each([
    ['with', (): X509Certificate => alice.x509],
    ['without', (): undefined => undefined]
  ])('refuses a signature of a different document %s a configured certificate', async(_, certificate) => {
    const stale = service(alice, { digest: () => new TextEncoder().encode('an earlier invoice').buffer })

    await expect(stale.sign(pdf, { date: new Date(), certificate: certificate() })).rejects.toThrow('The returned signature belongs to a different document')
  })

  it('names both signers when the signature is not from the configured certificate', async() => {
    await expect(service(bob).sign(pdf, { date: new Date(), certificate: alice.x509 })).rejects.toThrow(
      'The returned signature is signed by Bob (serial 02), but the configured certificate is Alice (serial 01).'
    )
  })

  it('refuses a signature that does not verify', async() => {
    await expect(service(alice, { tamper: true }).sign(pdf, { date: new Date(), certificate: alice.x509 })).rejects.toThrow(
      'The returned signature does not verify against the certificate of Alice (serial 01).'
    )
  })

  it('refuses a signature that is cut short', async() => {
    const complete = await sign(new ArrayBuffer(8), alice)
    const truncated = new SignatureService({ name: 'test', sign: async() => complete.subarray(0, 500) } as unknown as ATrustAdapter)

    await expect(truncated.sign(pdf, { date: new Date(), certificate: alice.x509 })).rejects.toThrow(`The returned signature is incomplete, got 500 of ${complete.length} bytes.`)
  })

  it('refuses something that is not a CMS signature', async() => {
    const garbage = new SignatureService({ name: 'test', sign: async() => Buffer.from([0x30, 0x03, 0x02, 0x01, 0x01]) } as unknown as ATrustAdapter)

    await expect(garbage.sign(pdf, { date: new Date() })).rejects.toThrow('The returned signature can not be parsed as a CMS signature')
  })
})
