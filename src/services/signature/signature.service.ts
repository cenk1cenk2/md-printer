import { Injectable } from '@nestjs/common'
import { plainAddPlaceholder } from '@signpdf/placeholder-plain'
import { findByteRange, removeTrailingNewLine, SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils'
import { webcrypto, X509Certificate } from 'crypto'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { isAbsolute, join } from 'path'
import type { SignedData } from 'pkijs'
import { getAlgorithmByOID } from 'pkijs'

import { ATrustAdapter } from './adapters/a-trust.adapter.js'
import { IncompleteSignatureError, parseSignedData, SignatureVerificationError } from './cms.js'
import type { SignatureAdapter } from './signature.adapter.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import type { MdPrinterSignature, MdPrinterSignOptions, SignatureRequest } from '@interfaces'

@Injectable()
export class SignatureService {
  private static readonly LENGTH = 16384
  private static readonly MESSAGE_DIGEST = '1.2.840.113549.1.9.4'

  private readonly adapters: SignatureAdapter[]

  constructor(
    private readonly logger: LoggerService,
    aTrust: ATrustAdapter
  ) {
    this.logger.setup(this.constructor.name)

    this.adapters = [aTrust]
  }

  public get providers(): string[] {
    return this.adapters.map((adapter) => adapter.name)
  }

  public async certificate(file: string, date: Date): Promise<X509Certificate> {
    const path = file.replace(/^~(?=\/|$)/, homedir())
    const certificate = new X509Certificate(await readFile(isAbsolute(path) ? path : join(process.cwd(), path)))

    if (date < certificate.validFromDate || date > certificate.validToDate) {
      throw new Error(`Signing certificate is not valid at ${date.toISOString()}, it is valid from ${certificate.validFrom} to ${certificate.validTo}.`)
    }

    return certificate
  }

  public describe(date: Date, certificate?: X509Certificate): MdPrinterSignature {
    return {
      date: date
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC'),
      name: certificate && this.commonName(certificate.subject),
      issuer: certificate && this.commonName(certificate.issuer),
      serial: certificate?.serialNumber
    }
  }

  public async sign(pdf: Buffer, options: Omit<MdPrinterSignOptions, 'certificate'> & { date: Date; certificate?: X509Certificate }): Promise<Buffer> {
    const request = this.prepare(pdf, options)
    const cms = await this.adapter(options.provider).sign(request)

    const signer = await this.verify(request, cms, options.certificate).catch((err: Error) => {
      throw new SignatureVerificationError(err.message, cms, { cause: err })
    })

    this.logger.info('Signature is verified, signed by %s: the document digest matches and the signature is valid.', this.identify(signer))

    return this.embed(request, cms)
  }

  public adapter(provider?: string): SignatureAdapter {
    if (!provider) {
      return this.adapters[0]
    }

    const adapter = this.adapters.find((adapter) => adapter.name === provider)

    if (!adapter) {
      throw new Error(`Unknown signature provider "${provider}", available: ${this.providers.join(', ')}`)
    }

    return adapter
  }

  private prepare(pdf: Buffer, options: Pick<MdPrinterSignOptions, 'reason' | 'location' | 'contact'> & { date: Date }): SignatureRequest {
    const prepared = removeTrailingNewLine(
      plainAddPlaceholder({
        pdfBuffer: pdf,
        reason: options.reason ?? '',
        location: options.location ?? '',
        contactInfo: options.contact ?? '',
        name: '',
        signingTime: options.date,
        signatureLength: SignatureService.LENGTH,
        subFilter: SUBFILTER_ETSI_CADES_DETACHED,
        appName: 'md-printer'
      })
    )

    const { byteRangePlaceholder, byteRangePlaceholderPosition } = findByteRange(prepared)

    if (!byteRangePlaceholder) {
      throw new Error('Can not find the signature byte range placeholder in the PDF.')
    }

    const byteRangeEnd = byteRangePlaceholderPosition + byteRangePlaceholder.length
    const from = prepared.indexOf('<', prepared.indexOf('/Contents ', byteRangeEnd))
    const to = prepared.indexOf('>', from)

    return {
      pdf: Buffer.concat([
        prepared.subarray(0, byteRangePlaceholderPosition),
        Buffer.from(`/ByteRange [0 ${from} ${to + 1} ${prepared.length - to - 1}]`.padEnd(byteRangePlaceholder.length, ' ')),
        prepared.subarray(byteRangeEnd)
      ]),
      excluded: [from, to]
    }
  }

  private async verify({ pdf, excluded: [from, to] }: SignatureRequest, cms: Buffer, certificate?: X509Certificate): Promise<X509Certificate> {
    const content = new Uint8Array(Buffer.concat([pdf.subarray(0, from), pdf.subarray(to + 1)])).buffer
    let signed: SignedData

    try {
      signed = parseSignedData(cms)
    } catch(err) {
      if (err instanceof IncompleteSignatureError) {
        throw new Error(`The returned signature is incomplete, got ${err.received} of ${err.declared} bytes.`, { cause: err })
      }

      throw new Error(`The returned signature can not be parsed as a CMS signature: ${(err as Error).message}`, { cause: err })
    }

    const [info] = signed.signerInfos
    const digest = info?.signedAttrs?.attributes.find((attribute) => attribute.type === SignatureService.MESSAGE_DIGEST)

    if (!digest) {
      throw new Error('The returned signature does not carry the digest of the document it signs.')
    }

    const algorithm = getAlgorithmByOID(info.digestAlgorithm.algorithmId, true, 'digestAlgorithm')

    if (!Buffer.from(digest.values[0].valueBlock.valueHexView).equals(Buffer.from(await webcrypto.subtle.digest(algorithm.name, content)))) {
      throw new Error('The returned signature belongs to a different document.')
    }

    const { signatureVerified, signerCertificate } = await signed
      .verify({
        signer: 0,
        data: content,
        extendedMode: true
      })
      .catch((err: Error) => {
        throw new Error(`Can not verify the returned signature: ${err.message}`, { cause: err })
      })
    const signer = new X509Certificate(Buffer.from(signerCertificate.toSchema().toBER()))

    if (certificate && !signer.raw.equals(certificate.raw)) {
      throw new Error(
        [
          `The returned signature is signed by ${this.identify(signer)}, but the configured certificate is ${this.identify(certificate)}.`,
          'The signature block would show the wrong signer.'
        ].join(' ')
      )
    }

    if (!signatureVerified) {
      throw new Error(`The returned signature does not verify against the certificate of ${this.identify(signer)}.`)
    }

    return signer
  }

  private embed({ pdf, excluded: [from, to] }: SignatureRequest, cms: Buffer): Buffer {
    const signature = cms.toString('hex')
    const length = to - from - 1

    if (signature.length > length) {
      throw new Error(`Signature is ${signature.length} bytes but the placeholder only fits ${length}.`)
    }

    return Buffer.concat([pdf.subarray(0, from + 1), Buffer.from(signature.padEnd(length, '0')), pdf.subarray(to)])
  }

  private identify(certificate: X509Certificate): string {
    return `${this.commonName(certificate.subject)} (serial ${certificate.serialNumber}, issuer ${this.commonName(certificate.issuer)})`
  }

  private commonName(name: string): string {
    return name
      .split('\n')
      .find((part) => part.startsWith('CN='))
      ?.slice(3)
  }
}
