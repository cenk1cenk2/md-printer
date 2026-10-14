import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bin = join(root, 'bin', 'run.js')

/**
 * Runs the built CLI and resolves with its raw stdout, so the tests see exactly what a pipe would.
 */
function run(args, input) {
  return new Promise((resolve, reject) => {
    const options = {
      cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 120_000
    }
    const child = execFile(process.execPath, [bin, ...args], options, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`${err.message}\n${stderr.toString()}`))
      }

      resolve(stdout)
    })

    if (input !== undefined) {
      child.stdin.end(input)
    }
  })
}

function count(buffer, needle) {
  return buffer.toString('latin1').split(needle).length - 1
}

function pages(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe('md-printer', () => {
  let directory

  before(async() => {
    directory = await mkdtemp(join(tmpdir(), 'md-printer-test-'))
  })

  after(async() => {
    await rm(directory, { recursive: true, force: true })
  })

  for (const fixture of ['default', 'kilic.dev', 'invoice']) {
    it(`renders the ${fixture} fixture`, async() => {
      const output = join(directory, `${fixture}.pdf`)

      await run([join('test', `${fixture}.md`), output])

      const pdf = await readFile(output)

      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
      assert.equal(pages(pdf), 1)
    })
  }

  it('writes exactly one PDF to stdout', async() => {
    const stdout = await run([join('test', 'default.md'), '-O'])

    assert.equal(stdout.subarray(0, 5).toString(), '%PDF-')
    assert.equal(count(stdout, '%PDF-'), 1)
    assert.equal(count(stdout, '%%EOF'), 1)
  })

  it('reads markdown from stdin', async() => {
    const stdout = await run(['-O', '--stdin'], '# From stdin\n')

    assert.equal(stdout.subarray(0, 5).toString(), '%PDF-')
  })

  it('renders continuous mode as a single page', async() => {
    const output = join(directory, 'continuous.pdf')

    await run([join('test', 'continuous.md'), output])

    assert.equal(pages(await readFile(output)), 1)
  })

  it('prints header and footer page numbers on every page', async() => {
    const output = join(directory, 'two-pages.pdf')

    await run(['--stdin', '-t', 'kilic.dev', '-T', 'Two pages', output], '# One\n\n<div class="page-break"></div>\n\n# Two\n')

    const pdf = await readFile(output)

    assert.equal(pages(pdf), 2)
  })

  it('writes self-contained HTML for the mail template', async() => {
    const html = (await run([join('test', 'mail.md'), '-O'])).toString()

    assert.equal(count(Buffer.from(html), '<!doctype html>'), 1)
    assert.match(html, /<style/)
    assert.doesNotMatch(html, /md-printer\.local/)
    assert.doesNotMatch(html, /fonts\.(bunny|googleapis)/)
  })

  it('rejects templates in the 2.x format with a migration hint', async() => {
    await assert.rejects(run([join('test', 'default.md'), '-O', '-t', join('test', 'fixtures', 'legacy-template')]), /2\.x format/)
  })
})
