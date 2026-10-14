import { Injectable } from '@nestjs/common'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { createServer } from 'http'
import type { AddressInfo } from 'net'

import { SignatureAdapter } from '../signature.adapter.js'
import { LoggerService } from '@cenk1cenk2/oclif-common'
import type { SignatureRequest } from '@interfaces'

/**
 * Qualified electronic signature through ID Austria, using the A-Trust Security Layer 1.2 endpoint.
 *
 * The signing session runs entirely in the browser, since A-Trust closes the session for every other client once the user logs in.
 * The resulting CMS signature is displayed there and pasted back to a temporary local page.
 */
@Injectable()
export class ATrustAdapter extends SignatureAdapter {
  private static readonly ENDPOINT = 'https://service.a-trust.at/mobile/https-security-layer-request/default.aspx'
  private static readonly NAMESPACE = 'http://www.buergerkarte.at/namespaces/securitylayer/1.2#'
  private static readonly TIMEOUT = 600_000
  private static readonly PAGE = './a-trust.html'

  public readonly name = 'a-trust'

  constructor(private readonly logger: LoggerService) {
    super()

    this.logger.setup(this.constructor.name)
  }

  public async sign(request: SignatureRequest): Promise<Buffer> {
    return this.collect(await this.session(this.request(request)))
  }

  private request({ pdf, excluded: [from, to] }: SignatureRequest): string {
    // A-Trust expects the whole document with the excluded range blacked out, same as PDF-AS sends it
    const data = Buffer.from(pdf).fill(0, from, to + 1)

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<sl:CreateCMSSignatureRequest xmlns:sl="${ATrustAdapter.NAMESPACE}" Structure="detached" PAdESCompatibility="true">`,
      '<sl:KeyboxIdentifier>SecureSignatureKeypair</sl:KeyboxIdentifier>',
      '<sl:DataObject>',
      '<sl:MetaInfo><sl:MimeType>application/pdf</sl:MimeType></sl:MetaInfo>',
      `<sl:Content><sl:Base64Content>${data.toString('base64')}</sl:Base64Content></sl:Content>`,
      `<sl:ExcludedByteRange><sl:From>${from}</sl:From><sl:To>${to}</sl:To></sl:ExcludedByteRange>`,
      '</sl:DataObject>',
      '</sl:CreateCMSSignatureRequest>'
    ].join('')
  }

  private async session(request: string): Promise<string> {
    let url = ATrustAdapter.ENDPOINT
    let response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams([['XMLRequest', request]]),
      redirect: 'manual'
    })

    while (response.status === 301 || response.status === 302) {
      url = new URL(response.headers.get('location'), url).href
      response = await fetch(url, { redirect: 'manual' })
    }

    if (!response.ok || !url.includes('/identification.aspx')) {
      throw new Error(`A-Trust did not start a signing session, ended at ${url} with ${response.status}: ${(await response.text()).slice(0, 500)}`)
    }

    this.logger.debug('A-Trust signing session started: %s', url)

    return url
  }

  private async collect(login: string): Promise<Buffer> {
    let resolve: (cms: Buffer) => void
    let reject: (err: Error) => void
    const result = new Promise<Buffer>((done, fail) => {
      resolve = done
      reject = fail
    })

    const page = await readFile(new URL(ATrustAdapter.PAGE, import.meta.url))

    const server = createServer(async(req, res) => {
      if (req.method === 'GET' && req.url === '/session') {
        res.setHeader('content-type', 'application/json')
        res.writeHead(200)

        return res.end(JSON.stringify({ login }))
      }

      if (req.method !== 'POST' || req.url !== '/signature') {
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.writeHead(200)

        return res.end(page)
      }

      let body = ''

      for await (const chunk of req) {
        body += chunk
      }

      const cms = (body.match(/<(?:\w+:)?CMSSignature>([^<]+)</)?.[1] ?? body).replace(/\s+/g, '')

      if (!/^MII[A-Za-z0-9+/=]+$/.test(cms)) {
        res.writeHead(400)

        return res.end('This does not look like a signature, it should start with MII.')
      }

      res.writeHead(200)
      res.end('Signature received, you can close this tab.')

      resolve(Buffer.from(cms, 'base64'))
    })

    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))

    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`

    this.logger.info('Sign the document in the browser, then paste the signature back: %s', url)
    this.open(url)

    const timeout = setTimeout(() => reject(new Error('Timed out waiting for the signature.')), ATrustAdapter.TIMEOUT)

    return result.finally(() => {
      clearTimeout(timeout)
      server.close()
    })
  }

  private open(url: string): void {
    const [command, ...args] = process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url] : ['xdg-open', url]

    spawn(command, args, { stdio: 'ignore', detached: true })
      .on('error', (err) => this.logger.warn('Can not open the browser, open the link manually: %s', err.message))
      .unref()
  }
}
