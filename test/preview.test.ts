import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { request } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoggerService } from '@cenk1cenk2/oclif-common'
import type { SessionBuild } from '@interfaces'
import type { TemplateService } from '@services'
import { PreviewService } from '@services'

describe('PreviewService', () => {
  let directory: string
  let preview: PreviewService
  let url: URL
  const logger = { setup: (): void => undefined, debug: (): void => undefined } as unknown as LoggerService
  const template = { page: async(): Promise<string> => '<!doctype html>' } as unknown as TemplateService

  /**
   * Sends the path as is, since fetch would normalize a traversal away before it reaches the server.
   */
  function status(path: string): Promise<number> {
    return new Promise((resolve, reject) => {
      request(
        {
          host: url.hostname,
          port: url.port,
          path
        },
        (res) => {
          res.resume()
          resolve(res.statusCode)
        }
      )
        .on('error', reject)
        .end()
    })
  }

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-preview-'))

    await mkdir(join(directory, 'document'))
    await writeFile(join(directory, 'document', 'image.png'), 'image')
    await writeFile(join(directory, 'document', '.env'), 'SECRET=1')
    await writeFile(join(directory, 'outside.png'), 'outside')

    preview = new PreviewService(logger, template)
    url = new URL(await preview.listen({ host: '127.0.0.1', port: 0 }))
    preview.ready({
      ctx: { input: { directory: join(directory, 'document') }, options: {} },
      document: { html: '' },
      output: Buffer.from('')
    } as unknown as SessionBuild)
  })

  afterAll(async() => {
    await preview.close()
    await preview.onModuleDestroy()
    await rm(directory, { recursive: true, force: true })
  })

  it('serves the files next to the input', async() => {
    expect(await status('/image.png')).toBe(200)
  })

  it.each(['/.env', '/../outside.png', '/%2e%2e/outside.png'])('refuses %s', async(path) => {
    expect(await status(path)).toBeGreaterThanOrEqual(400)
  })

  it('rejects an occupied port instead of crashing', async() => {
    await expect(new PreviewService(logger, template).listen({ host: '127.0.0.1', port: Number(url.port) })).rejects.toThrow(/EADDRINUSE/)
  })
})
