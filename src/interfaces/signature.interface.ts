export interface SignatureRequest {
  pdf: Buffer
  excluded: [number, number]
}
