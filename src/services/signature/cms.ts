import { fromBER } from 'asn1js'
import { ContentInfo, SignedData } from 'pkijs'

export class IncompleteSignatureError extends Error {
  constructor(
    public readonly received: number,
    public readonly declared: number
  ) {
    super(`The signature is incomplete, got ${received} of ${declared} bytes.`)
  }
}

export class SignatureVerificationError extends Error {
  constructor(
    message: string,
    public readonly cms: Buffer,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

/**
 * Parses a DER encoded CMS SignedData, telling a signature that is cut short apart from one that is not a signature at all.
 */
export function parseSignedData(cms: Buffer): SignedData {
  const { offset, result } = fromBER(new Uint8Array(cms))

  if (offset === -1) {
    const declared = result.idBlock.blockLength + result.lenBlock.blockLength + result.lenBlock.length

    if (declared > cms.length) {
      throw new IncompleteSignatureError(cms.length, declared)
    }

    throw new Error(result.error)
  }

  const info = new ContentInfo({ schema: result })

  if (info.contentType !== ContentInfo.SIGNED_DATA) {
    throw new Error(`Expected CMS SignedData but got content type ${info.contentType}.`)
  }

  return new SignedData({ schema: info.content })
}
