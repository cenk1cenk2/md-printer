import { Injectable } from '@nestjs/common'
import { spawn } from 'child_process'
import { once } from 'events'
import { readFile } from 'fs/promises'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import type { RawBodyError } from 'raw-body'
import getRawBody from 'raw-body'

import type { MdPrinterSchema } from '../../../modules/md-printer/md-printer.schema.js'
import { isLoopbackRequest } from '../../loopback.js'
import { AppWindow } from '../../renderer/app-window.js'
import { BrowserNotFoundError } from '../../renderer/browser.js'
import { BrowserService } from '../../renderer/browser.service.js'
import { IncompleteSignatureError, parseSignedData } from '../cms.js'
import { SignatureAdapter } from '../signature.adapter.js'
import { CommandContext, LoggerService } from '@cenk1cenk2/oclif-common'
import { SignatureProvider } from '@constants'
import type { SignatureRequest } from '@interfaces'

/**
 * Qualified electronic signature through ID Austria, using the A-Trust Security Layer 1.2 endpoint.
 *
 * The signing session runs entirely in the browser, since A-Trust closes the session for every other client once the user logs in.
 * The resulting CMS signature is displayed there and pasted back to a temporary local page.
 * Every signing gets its own browser window and profile, so a result left over from an earlier signing is never at hand to paste.
 */
@Injectable()
export class ATrustAdapter extends SignatureAdapter {
  public readonly name = SignatureProvider.A_TRUST

  constructor(
    private readonly logger: LoggerService,
    private readonly context: CommandContext<typeof MdPrinterSchema>,
    private readonly browser: BrowserService
  ) {
    super()

    this.logger.setup(this.constructor.name)
  }

  public async sign(request: SignatureRequest): Promise<Buffer> {
    return this.collect(await this.session(this.request(request)))
  }

  private request({ pdf, excluded: [from, to] }: SignatureRequest): string {
    // A-Trust expects the whole document with the excluded range blacked out, same as PDF-AS sends it
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sl:CreateCMSSignatureRequest xmlns:sl="http://www.buergerkarte.at/namespaces/securitylayer/1.2#" Structure="detached" PAdESCompatibility="true">',
      '<sl:KeyboxIdentifier>SecureSignatureKeypair</sl:KeyboxIdentifier>',
      '<sl:DataObject>',
      '<sl:MetaInfo><sl:MimeType>application/pdf</sl:MimeType></sl:MetaInfo>',
      `<sl:Content><sl:Base64Content>${Buffer.from(pdf)
        .fill(0, from, to + 1)
        .toString('base64')}</sl:Base64Content></sl:Content>`,
      `<sl:ExcludedByteRange><sl:From>${from}</sl:From><sl:To>${to}</sl:To></sl:ExcludedByteRange>`,
      '</sl:DataObject>',
      '</sl:CreateCMSSignatureRequest>'
    ].join('')
  }

  private async session(request: string): Promise<string> {
    let url = 'https://service.a-trust.at/mobile/https-security-layer-request/default.aspx'
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

    const page = await readFile(new URL('./a-trust.html', import.meta.url))

    const server = createServer(async(req, res) => {
      if (!isLoopbackRequest(req, req.method === 'POST' ? `http://127.0.0.1:${(server.address() as AddressInfo).port}` : undefined)) {
        res.writeHead(403)

        return res.end()
      }

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

      // a CMS signature is a few hundred kilobytes at most, anything larger is not one
      const body = await getRawBody(req, { limit: '1mb', encoding: true }).catch((err: RawBodyError): undefined => {
        res.writeHead(err.status ?? 400)
        res.end()

        return undefined
      })

      if (body === undefined) {
        return
      }

      const cms = (body.match(/<(?:\w+:)?CMSSignature>([^<]+)</)?.[1] ?? body).replace(/\s+/g, '')

      if (!/^MII[A-Za-z0-9+/=]+$/.test(cms)) {
        res.writeHead(400)

        return res.end('This does not look like a signature, it should start with MII.')
      }

      const signature = Buffer.from(cms, 'base64')

      try {
        parseSignedData(signature)
      } catch(err) {
        res.writeHead(400)

        if (err instanceof IncompleteSignatureError) {
          return res.end(`The pasted signature is incomplete (got ${err.received} of ${err.declared} bytes), copy the whole signature text from the A-Trust page.`)
        }

        return res.end(`The pasted text is not a CMS signature: ${(err as Error).message}`)
      }

      res.writeHead(200)
      res.end('Signature received.')

      resolve(signature)
    })

    server.listen(0, '127.0.0.1')

    await once(server, 'listening')

    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`

    this.logger.info('Sign the document in the browser, then paste the signature back: %s', url)

    const window = await this.open(url).catch((err: Error) => {
      server.close()

      throw err
    })

    this.context.signal.addEventListener('abort', () => reject(new Error('Signing is aborted.')), { once: true })

    window?.closed.then(
      () => reject(new Error('The signing window is closed before the signature arrived.')),
      (err: Error) => this.logger.warn('Can not open the signing window, open the link manually: %s (%s)', url, err.message)
    )

    return result.finally(async() => {
      server.close()

      await window?.close()
    })
  }

  private async open(url: string): Promise<AppWindow | undefined> {
    let executable: string

    try {
      executable = this.browser.executable()
    } catch(err) {
      if (!(err instanceof BrowserNotFoundError)) {
        throw err
      }

      this.logger.warn('Can not find a browser to sign in a window of its own, close the tabs of any earlier signing before you continue. %s', err.message)

      spawn('xdg-open', [url], { stdio: 'ignore', detached: true })
        .on('error', (err) => this.logger.warn('Can not open the browser, open the link manually: %s', err.message))
        .unref()

      return
    }

    return AppWindow.open(executable, url)
  }
}
