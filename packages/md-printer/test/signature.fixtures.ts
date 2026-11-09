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

export interface Identity {
  certificate: Certificate
  key: CryptoKey
  x509: X509Certificate
}

export interface SignOptions {
  digest?: (content: ArrayBuffer) => ArrayBuffer
  tamper?: boolean
}

/**
 * A self-signed certificate with a fresh key pair.
 */
export async function identity(name: string, serial: number, algorithm: EcKeyGenParams | RsaHashedKeyGenParams): Promise<Identity> {
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
 * A detached CMS signature (DER) over the content with signed attributes, the way A-Trust returns it.
 */
export async function sign(content: ArrayBuffer, signer: Identity, options: SignOptions = {}): Promise<Buffer> {
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

  return Buffer.from(new ContentInfo({ contentType: ContentInfo.SIGNED_DATA, content: signed.toSchema(true) }).toSchema().toBER())
}

/**
 * A single blank page with a classic cross-reference table, which is what the signature placeholder expects.
 */
export function document(): Buffer {
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
