import type { SignatureRequest } from '@interfaces'

export abstract class SignatureAdapter {
  public abstract readonly name: string

  /**
   * Returns a detached CMS signature (DER) over the PDF without the excluded byte range.
   */
  public abstract sign(request: SignatureRequest): Promise<Buffer>
}
