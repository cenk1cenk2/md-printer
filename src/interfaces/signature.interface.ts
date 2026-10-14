export interface MdPrinterSignOptions {
  enabled?: boolean
  provider?: string
  certificate?: string
  reason?: string
  location?: string
  contact?: string
}

export interface MdPrinterSignature {
  date: string
  name?: string
  issuer?: string
  serial?: string
}

export interface SignatureRequest {
  pdf: Buffer
  excluded: [number, number]
}
