import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

/**
 * Runs the built CLI and resolves with its raw stdout, so the tests see exactly what a pipe would.
 */
function run(args: string[], input?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [join(root, 'bin', 'run.js'), ...args],
      {
        cwd: root,
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024
      },
      (err, stdout, stderr) => (err ? reject(new Error(`${err.message}\n${stderr.toString()}`)) : resolve(stdout))
    )

    if (input !== undefined) {
      child.stdin.end(input)
    }
  })
}

function count(buffer: Buffer, needle: string): number {
  return buffer.toString('latin1').split(needle).length - 1
}

function pages(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0
}

describe('md-printer', () => {
  let directory: string

  beforeAll(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-test-'))
  })

  afterAll(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  it.each(['default', 'kilic.dev', 'invoice'])('renders the %s fixture', async(fixture) => {
    const output = join(directory, `${fixture}.pdf`)

    await run([join('test', `${fixture}.md`), output])

    const pdf = await readFile(output)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pages(pdf)).toBe(1)
  })

  it('writes exactly one PDF to stdout', async() => {
    const stdout = await run([join('test', 'default.md'), '-O'])

    expect(stdout.subarray(0, 5).toString()).toBe('%PDF-')
    expect(count(stdout, '%PDF-')).toBe(1)
    expect(count(stdout, '%%EOF')).toBe(1)
  })

  it('reads markdown from stdin', async() => {
    expect((await run(['-O', '--stdin'], '# From stdin\n')).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders continuous mode as a single page', async() => {
    const output = join(directory, 'continuous.pdf')

    await run([join('test', 'continuous.md'), output])

    expect(pages(await readFile(output))).toBe(1)
  })

  it('prints header and footer on every page', async() => {
    const output = join(directory, 'two-pages.pdf')

    await run(['--stdin', '-t', 'kilic.dev', '-T', 'Two pages', output], '# One\n\n<div class="page-break"></div>\n\n# Two\n')

    expect(pages(await readFile(output))).toBe(2)
  })

  it('writes self-contained HTML for the mail template', async() => {
    const html = (await run([join('test', 'mail.md'), '-O'])).toString()

    expect(count(Buffer.from(html), '<!doctype html>')).toBe(1)
    expect(html).toMatch(/<style/)
    expect(html).not.toMatch(/md-printer\.local/)
    expect(html).not.toMatch(/fonts\.(bunny|googleapis)/)
  })

  it('fails on a directory without a template', async() => {
    await expect(run([join('test', 'default.md'), '-O', '-t', 'test'])).rejects.toThrow(/Template does not exist/)
  })

  it('fails instead of writing to the terminal when there is no output', async() => {
    await expect(run(['--stdin'], '# No output\n')).rejects.toThrow(/No output file to write/)
  })

  it('reads files with an unknown extension as markdown', async() => {
    const input = join(directory, 'notes.txt')

    await writeFile(input, '# Notes\n')

    expect((await run([input, '-O'])).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('escapes a template title once', async() => {
    const template = join(directory, 'title-template')

    await mkdir(template, { recursive: true })
    await writeFile(join(template, 'Template.svelte'), '<svelte:head><title>{"R&D <1>"}</title></svelte:head>\n<p>body</p>\n')

    const html = (await run(['--stdin', '-O', '-F', 'html', '-t', template], '# Title\n')).toString()

    expect(html).toContain('<title>R&amp;D &lt;1></title>')
  })

  it('starts a new page at a PageBreak component', async() => {
    const template = join(directory, 'page-break-template')

    await mkdir(template, { recursive: true })
    await writeFile(
      join(template, 'Template.svelte'),
      '<script>\n  import { PageBreak } from \'@cenk1cenk2/md-printer/components\'\n</script>\n\n<p>one</p>\n<PageBreak />\n<p>two</p>\n'
    )

    expect(pages(await run(['--stdin', '-O', '-t', template], '# Pages\n'))).toBe(2)
  })

  it('breaks pages at ::pagebreak, inside flex layouts and in continuous mode', async() => {
    const markdown = '# One\n\n::pagebreak\n\n<div style="display: flex"><div>left</div><div class="page-break"></div><div>right</div></div>\n'

    expect(pages(await run(['--stdin', '-O'], markdown))).toBe(3)
    expect(pages(await run(['--stdin', '-O', '--continuous'], markdown))).toBe(3)
  })

  it('keeps text that only looks like a directive', async() => {
    const html = (await run(['--stdin', '-O', '-F', 'html'], 'Meet at 10:30am, note:here.\n')).toString()

    expect(html).toContain('Meet at 10:30am, note:here.')
  })
})
