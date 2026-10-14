import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoggerService } from '@cenk1cenk2/oclif-common'
import type { MdPrinterCtx, MdPrinterFlags, PrinterOutput, RenderedDocument, SessionBuild, TemplateBundle } from '@interfaces'
import type { PrinterService } from '@services'
import { SessionService } from '@services'

describe('SessionService', () => {
  let directory: string

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-session-'))

    await writeFile(join(directory, 'input.md'), '# Input\n')
    await writeFile(join(directory, 'Template.svelte'), 'old')
  })

  afterAll(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it('rebuilds with the new template when it changes while bundling', async() => {
    const logger = { setup: (): void => undefined, debug: (): void => undefined } as unknown as LoggerService
    let edit: () => void
    const edited = new Promise<void>((resolve) => {
      edit = resolve
    })
    const bundles: string[] = []

    const printer = {
      input: async() => ({
        file: join(directory, 'input.md'),
        directory,
        content: '',
        data: {}
      }),
      options: async() => ({ template: directory, sign: {} }),
      bundle: async(): Promise<TemplateBundle> => {
        const source = await readFile(join(directory, 'Template.svelte'), 'utf8')

        bundles.push(source)

        // the first bundle only finishes after the template was edited
        if (bundles.length === 1) {
          edit()

          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        return {
          entry: undefined,
          modules: [join(directory, 'Template.svelte')],
          stylesheets: [],
          source
        } as TemplateBundle
      },
      prepare: async(): Promise<void> => undefined,
      document: async(_ctx: MdPrinterCtx, bundle: TemplateBundle & { source: string }): Promise<RenderedDocument> => ({ html: bundle.source, dependencies: [] }),
      output: async(): Promise<PrinterOutput> => ({ content: Buffer.from(''), assets: [] })
    } as unknown as PrinterService

    const session = new SessionService(logger, printer)
    const ready: SessionBuild[] = []

    session.on('ready', (build) => ready.push(build))
    session.on('failed', (err) => {
      throw err
    })

    const started = session.start({ file: join(directory, 'input.md') } as MdPrinterFlags)

    await edited
    // chokidar needs a moment to pick up the file it was just told to watch
    await new Promise((resolve) => setTimeout(resolve, 200))
    await writeFile(join(directory, 'Template.svelte'), 'new')
    await started

    await expect.poll(() => ready.at(-1)?.document.html, { timeout: 10_000 }).toBe('new')
    expect(ready.map((build) => build.document.html)).not.toContain('old')

    await session.stop()
    await session.onModuleDestroy()
  })
})
