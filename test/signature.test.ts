import { Integer, ObjectIdentifier, OctetString, Utf8String } from 'asn1js'
import { webcrypto, X509Certificate } from 'crypto'
import {
  Attribute,
  AttributeTypeAndValue,
  Certificate,
  ContentInfo,
  EncapsulatedContentInfo,
  IssuerAndSerialNumber,
  SignedAndUnsignedAttributes,
  SignedData,
  SignerInfo
} from 'pkijs'
import { beforeAll, describe, expect, it } from 'vitest'

import type { SignatureRequest } from '@interfaces'
import type { ATrustAdapter } from '@services'
import { SignatureService } from '@services'

describe('SignatureService', () => {
  interface Identity {
    certificate: Certificate
    key: CryptoKey
    x509: X509Certificate
  }

  interface SignOptions {
    digest?: (content: ArrayBuffer) => ArrayBuffer
    tamper?: boolean
  }

  let pdf: Buffer
  let returned: Buffer
  let alice: Identity
  let bob: Identity

  async function identity(name: string, serial: number, algorithm: EcKeyGenParams | RsaHashedKeyGenParams): Promise<Identity> {
    const keys = (await webcrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])) as CryptoKeyPair
    const certificate = new Certificate()
    const subject = new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: name }) })

    certificate.version = 2
    certificate.serialNumber = new Integer({ value: serial })
    certificate.subject.typesAndValues.push(subject)
    certificate.issuer.typesAndValues.push(subject)
    certificate.notBefore.value = new Date(Date.now() - 86_400_000)
    certificate.notAfter.value = new Date(Date.now() + 86_400_000)

    await certificate.subjectPublicKeyInfo.importKey(keys.publicKey)
    await certificate.sign(keys.privateKey, 'SHA-256')

    return {
      certificate,
      key: keys.privateKey,
      x509: new X509Certificate(Buffer.from(certificate.toSchema().toBER()))
    }
  }

  /**
   * Builds a detached CMS signature over the byte range content of the request, the way A-Trust returns it.
   */
  async function cms({ pdf, excluded: [from, to] }: SignatureRequest, signer: Identity, options: SignOptions = {}): Promise<Buffer> {
    const content = new Uint8Array(Buffer.concat([pdf.subarray(0, from), pdf.subarray(to + 1)])).buffer
    const signed = new SignedData({
      version: 1,
      encapContentInfo: new EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
      signerInfos: [
        new SignerInfo({
          version: 1,
          sid: new IssuerAndSerialNumber({ issuer: signer.certificate.issuer, serialNumber: signer.certificate.serialNumber }),
          signedAttrs: new SignedAndUnsignedAttributes({
            type: 0,
            attributes: [
              new Attribute({ type: '1.2.840.113549.1.9.3', values: [new ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
              new Attribute({
                type: '1.2.840.113549.1.9.4',
                values: [new OctetString({ valueHex: await webcrypto.subtle.digest('SHA-256', options.digest?.(content) ?? content) })]
              })
            ]
          })
        })
      ],
      certificates: [signer.certificate]
    })

    await signed.sign(signer.key, 0, 'SHA-256', content)

    if (options.tamper) {
      const signature = signed.signerInfos[0].signature.valueBlock.valueHexView

      signature[8] = 255 - signature[8]
    }

    returned = Buffer.from(new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: signed.toSchema(true) }).toSchema().toBER())

    return returned
  }

  function service(signer: Identity, options?: SignOptions): SignatureService {
    return new SignatureService({ name: 'test', sign: (request: SignatureRequest) => cms(request, signer, options) } as unknown as ATrustAdapter)
  }

  /**
   * A single blank page with a classic cross-reference table, which is what the placeholder expects.
   */
  function document(): Buffer {
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>']
    let body = '%PDF-1.7\n'
    const offsets = objects.map((object, index) => {
      const offset = body.length

      body += `${index + 1} 0 obj\n${object}\nendobj\n`

      return offset
    })

    return Buffer.from(
      [
        body + `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
        ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`
      ].join(''),
      'latin1'
    )
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

  it('refuses something that is not a CMS signature', async() => {
    const garbage = new SignatureService({ name: 'test', sign: async() => Buffer.from('MIIB') } as unknown as ATrustAdapter)

    await expect(garbage.sign(pdf, { date: new Date() })).rejects.toThrow('The returned signature is not a CMS signature')
  })
})
