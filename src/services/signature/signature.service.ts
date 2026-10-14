import { Injectable } from '@nestjs/common'
import { plainAddPlaceholder } from '@signpdf/placeholder-plain'
import { findByteRange, removeTrailingNewLine, SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils'
import { X509Certificate } from 'crypto'
import { homedir } from 'os'
import { isAbsolute, join } from 'path'

import { ATrustAdapter } from './adapters/a-trust.adapter.js'
import type { SignatureAdapter } from './signature.adapter.js'
import { FileSystemService } from '@cenk1cenk2/oclif-common'
import type { MdPrinterSignature, MdPrinterSignOptions, SignatureRequest } from '@interfaces'

@Injectable()
export class SignatureService {
  private static readonly LENGTH = 16384

  private readonly adapters: SignatureAdapter[]

  constructor(
    private readonly fs: FileSystemService,
    aTrust: ATrustAdapter
  ) {
    this.adapters = [aTrust]
  }

  public get providers(): string[] {
    return this.adapters.map((adapter) => adapter.name)
  }

  public async certificate(file: string, date: Date): Promise<X509Certificate> {
    const path = file.replace(/^~(?=\/|$)/, homedir())
    const certificate = new X509Certificate(await this.fs.extra.readFile(isAbsolute(path) ? path : join(process.cwd(), path)))

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

    if (options.certificate && !cms.includes(options.certificate.raw)) {
      throw new Error('The returned signature was not created with the configured certificate, the signature block would show the wrong signer.')
    }

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

  private embed({ pdf, excluded: [from, to] }: SignatureRequest, cms: Buffer): Buffer {
    const signature = cms.toString('hex')
    const length = to - from - 1

    if (signature.length > length) {
      throw new Error(`Signature is ${signature.length} bytes but the placeholder only fits ${length}.`)
    }

    return Buffer.concat([pdf.subarray(0, from + 1), Buffer.from(signature.padEnd(length, '0')), pdf.subarray(to)])
  }

  private commonName(name: string): string {
    return name
      .split('\n')
      .find((part) => part.startsWith('CN='))
      ?.slice(3)
  }
}
