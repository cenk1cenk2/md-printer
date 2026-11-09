import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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

  it.each(['default', 'kilic.dev', 'invoice', 'cv'])('renders the %s fixture', async(fixture) => {
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

  it('applies the default template when none is given', async() => {
    const html = (await run(['--stdin', '-O', '-F', 'html'], '# Default\n')).toString()

    expect(html).toContain('Montserrat')
  })

  it('resolves the dependencies a template brings in its own node_modules before md-printer ones', async() => {
    const template = join(directory, 'template-with-dependencies')
    const modules = join(template, 'node_modules')

    await mkdir(join(modules, 'local-kit'), { recursive: true })
    await writeFile(
      join(modules, 'local-kit', 'package.json'),
      JSON.stringify({
        name: 'local-kit',
        main: 'index.js',
        type: 'module'
      })
    )
    await writeFile(join(modules, 'local-kit', 'index.js'), 'export const greeting = \'from local-kit\'\n')
    await writeFile(join(modules, 'local-kit', 'mark.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')
    // md-printer depends on both packages itself, the template's copies have to win
    await mkdir(join(modules, 'yaml'), { recursive: true })
    await writeFile(
      join(modules, 'yaml', 'package.json'),
      JSON.stringify({
        name: 'yaml',
        main: 'index.js',
        type: 'module'
      })
    )
    await writeFile(join(modules, 'yaml', 'index.js'), 'export const stringify = () => \'template yaml\'\n')
    await mkdir(join(modules, 'highlight.js', 'styles'), { recursive: true })
    await writeFile(join(modules, 'highlight.js', 'package.json'), JSON.stringify({ name: 'highlight.js' }))
    await writeFile(join(modules, 'highlight.js', 'styles', 'github.css'), '.template-css { color: rgb(1, 2, 3); }\n')
    await writeFile(
      join(template, 'Template.svelte'),
      [
        '<script lang="ts">',
        '  import { greeting } from \'local-kit\'',
        '  import mark from \'local-kit/mark.svg\'',
        '  import { stringify } from \'yaml\'',
        '</script>',
        '',
        '<p class="template-css">{greeting} / {stringify()}</p>',
        '<img src={mark} alt="" />',
        '',
        '<style lang="postcss">',
        '  @import \'highlight.js/styles/github.css\';',
        '</style>',
        ''
      ].join('\n')
    )

    const html = (await run(['--stdin', '-O', '-F', 'html', '-t', template], '# Dependencies\n')).toString()

    expect(html).toContain('from local-kit / template yaml')
    expect(html).toContain('src="data:image/svg+xml;base64,')
    expect(html).toMatch(/\.template-css\s*\{\s*color:\s*(rgb\(1,\s*2,\s*3\)|#010203)/)
  })

  it('names the template directory when a dependency of the template is not installed', async() => {
    const template = join(directory, 'template-missing-dependency')

    await mkdir(template, { recursive: true })
    await writeFile(
      join(template, 'Template.svelte'),
      ['<script lang="ts">', '  import { greeting } from \'not-installed-kit\'', '</script>', '', '<p>{greeting}</p>', ''].join('\n')
    )

    await expect(run(['--stdin', '-O', '-F', 'html', '-t', template], '# Missing\n')).rejects.toThrow(
      new RegExp(`not-installed-kit[\\s\\S]*Install it in the template directory: ${template}`)
    )
  })

  describe('template sources', () => {
    const document = async(name: string, template: unknown): Promise<string> => {
      const input = join(directory, name, 'nested', 'document.md')

      await mkdir(join(directory, name, 'nested'), { recursive: true })
      await writeFile(input, `---\ntemplate: ${JSON.stringify(template)}\n---\n\n# Document\n`)

      return input
    }

    const template = async(path: string, marker: string): Promise<void> => {
      await mkdir(path, { recursive: true })
      await writeFile(join(path, 'Template.svelte'), `<p>${marker}</p>\n`)
    }

    const install = async(root: string, name: string, marker: string): Promise<string> => {
      const pkg = join(root, 'node_modules', name)

      await template(pkg, marker)
      await writeFile(join(pkg, 'package.json'), JSON.stringify({ name, version: '1.0.0' }))

      return pkg
    }

    const html = async(input: string): Promise<string> => (await run([input, '-O', '-F', 'html'])).toString()

    it.each(['mock-template', '@mock-scope/mock-template'])('resolves the package %s from the node_modules of the document, walking up', async(name) => {
      const input = await document('package', { type: 'package', name })

      await install(join(directory, 'package'), name, `from ${name}`)

      expect(await html(input)).toContain(`from ${name}`)
    })

    it('prefers the package of the document over the copy of md-printer', async() => {
      const name = '@cenk1cenk2/md-printer-template-default'
      const input = await document('shadowed', { type: 'package', name })

      await install(join(directory, 'shadowed'), name, 'from the document')

      expect(await html(input)).toContain('from the document')
    })

    it('falls back to the package of md-printer', async() => {
      expect(await html(await document('fallback', { type: 'package', name: '@cenk1cenk2/md-printer-template-default' }))).toContain('Montserrat')
    })

    it('selects a directory inside the package', async() => {
      const input = await document('subdirectory', {
        type: 'package',
        name: 'mock-template',
        directory: 'sub/dir'
      })

      await template(join(await install(join(directory, 'subdirectory'), 'mock-template', 'from the root'), 'sub', 'dir'), 'from the subdirectory')

      expect(await html(input)).toContain('from the subdirectory')
    })

    it.each(['../outside', 'link'])('rejects the directory %s escaping the package', async(escape) => {
      const name = `escape-${escape.replace(/\W/g, '')}`
      const input = await document(name, {
        type: 'package',
        name: 'mock-template',
        directory: escape
      })
      const pkg = await install(join(directory, name), 'mock-template', 'from the root')

      await template(join(pkg, '..', 'outside'), 'from outside')
      await symlink(join(pkg, '..', 'outside'), join(pkg, 'link'))

      await expect(html(input)).rejects.toThrow(new RegExp(`Template directory "${escape}" of the package mock-template has to exist inside the package`))
    })

    it('fails naming where it looked for a package that is not installed', async() => {
      await expect(html(await document('unknown', { type: 'package', name: '@mock-scope/not-installed' }))).rejects.toThrow(
        new RegExp(`the package @mock-scope/not-installed is not installed in any of: ${join(directory, 'unknown', 'nested')}`)
      )
    })

    it('resolves a built-in template', async() => {
      expect(await html(await document('builtin', { type: 'builtin', name: 'default' }))).toContain('Montserrat')
    })

    it('fails on an unknown built-in template', async() => {
      await expect(html(await document('unknown-builtin', { type: 'builtin', name: 'not-a-template' }))).rejects.toThrow(/@cenk1cenk2\/md-printer-template-not-a-template/)
    })

    it('resolves a directory relative to the document', async() => {
      const input = await document('relative', { type: 'directory', path: './template' })

      await template(join(directory, 'relative', 'nested', 'template'), 'from the directory')

      expect(await html(input)).toContain('from the directory')
    })

    it.each([
      [{ type: 'mystery', name: 'cv' }, /Template is invalid: .*type of builtin, package, directory/],
      [{ name: 'cv' }, /Template is invalid: .*type of builtin, package, directory/],
      [42, /Template is invalid: .*type of builtin, package, directory/],
      [{ type: 'builtin' }, /Template is invalid: name: /],
      [{ type: 'package' }, /Template is invalid: name: /],
      [{ type: 'directory' }, /Template is invalid: path: /],
      [{ type: 'package', name: '../outside' }, /Template is invalid: name: Not an npm package name/],
      [{ type: 'builtin', name: '../outside' }, /Template is invalid: name: Built-in template names have no path separator/]
    ])('rejects %j', async(source, message) => {
      await expect(html(await document('invalid', source))).rejects.toThrow(message)
    })

    describe('flags', () => {
      const flags = async(input: string, ...args: string[]): Promise<string> => (await run([input, '-O', '-F', 'html', ...args])).toString()

      it('resolves a package', async() => {
        const input = await document('flag-package', 'default')

        await install(join(directory, 'flag-package'), '@mock-scope/mock-template', 'from the flag package')

        expect(await flags(input, '--template-type', 'package', '-t', '@mock-scope/mock-template')).toContain('from the flag package')
      })

      it('selects a directory inside the package', async() => {
        const input = await document('flag-subdirectory', 'default')

        await template(join(await install(join(directory, 'flag-subdirectory'), 'mock-template', 'from the root'), 'sub'), 'from the flag subdirectory')

        expect(await flags(input, '--template-type', 'package', '-t', 'mock-template', '--template-directory', 'sub')).toContain('from the flag subdirectory')
      })

      it('rejects a directory escaping the package like the front-matter does', async() => {
        const input = await document('flag-escape', 'default')

        await install(join(directory, 'flag-escape'), 'mock-template', 'from the root')

        await expect(flags(input, '--template-type', 'package', '-t', 'mock-template', '--template-directory', '..')).rejects.toThrow(
          /Template directory "\.\." of the package mock-template has to exist inside the package/
        )
      })

      it.each([
        ['without a type', ['-t', 'default', '--template-directory', 'sub']],
        ['with another type', ['--template-type', 'builtin', '-t', 'default', '--template-directory', 'sub']]
      ])('rejects --template-directory %s', async(_, args) => {
        await expect(flags(await document('flag-invalid', 'default'), ...args)).rejects.toThrow(/--template-directory is only valid with --template-type package/)
      })

      it('rejects --template-type without --template', async() => {
        await expect(flags(await document('flag-invalid', 'default'), '--template-type', 'package')).rejects.toThrow(/--template-type needs --template/)
      })

      it('validates with the schema of the front-matter', async() => {
        const input = await document('flag-invalid', 'default')

        await expect(flags(input, '--template-type', 'mystery', '-t', 'default')).rejects.toThrow(/Template is invalid: .*type of builtin, package, directory/)
        await expect(flags(input, '--template-type', 'package', '-t', '../outside')).rejects.toThrow(/Template is invalid: name: Not an npm package name/)
      })

      it('resolves a built-in template and a directory relative to the document', async() => {
        const input = await document('flag-types', { type: 'builtin', name: 'not-a-template' })

        await template(join(directory, 'flag-types', 'nested', 'template'), 'from the flag directory')

        expect(await flags(input, '--template-type', 'builtin', '-t', 'default')).toContain('Montserrat')
        expect(await flags(input, '--template-type', 'directory', '-t', './template')).toContain('from the flag directory')
      })

      it('overrides the front-matter', async() => {
        const input = await document('flag-override', { type: 'package', name: 'front-matter-template' })

        await install(join(directory, 'flag-override'), 'front-matter-template', 'from the front-matter')
        await install(join(directory, 'flag-override'), 'flag-template', 'from the flag')

        expect(await html(input)).toContain('from the front-matter')
        expect(await flags(input, '--template-type', 'package', '-t', 'flag-template')).toContain('from the flag')
      })
    })

    it('keeps a package name in the string form and the flag a path', async() => {
      const name = '@mock-scope/mock-template'
      const input = await document('string', name)

      await install(join(directory, 'string'), name, 'from the package')

      await expect(html(input)).rejects.toThrow(/Template does not exist/)
      await expect(run([input, '-O', '-F', 'html', '-t', name])).rejects.toThrow(/Template does not exist/)
    })
  })

  describe('shared components', () => {
    const scaffold = async(name: string, files: [string, string][]): Promise<string> => {
      const template = join(directory, name)

      await Promise.all(
        files.map(async([file, content]) => {
          await mkdir(dirname(join(template, file)), { recursive: true })
          await writeFile(join(template, file), content)
        })
      )

      return template
    }

    const html = async(template: string, markdown: string, args: string[] = []): Promise<string> =>
      (await run(['--stdin', '-O', '-F', 'html', '-t', template, ...args], markdown)).toString()

    describe('overriding', () => {
      const components = async(): Promise<string[]> =>
        [...(await readFile(join(root, 'src', 'components', 'index.ts'), 'utf8')).matchAll(/default as (\w+)/g)].map(([, name]) => name)

      const kebab = (name: string): string => name.replace(/(?<=[a-z])[A-Z]/g, (letter) => `-${letter}`).toLowerCase()

      const shell = '<script>\n  import { Markdown } from \'@cenk1cenk2/md-printer/components\'\n</script>\n\n<Markdown />\n'

      it('replaces every shared component as a directive', async() => {
        const names = await components()
        const template = await scaffold('override-template', [
          ['Template.svelte', shell],
          ...names.map((name): [string, string] => [`components/${name}.svelte`, `<p class="override">template ${name}</p>\n`])
        ])

        const output = await html(template, names.map((name) => `::${kebab(name)}`).join('\n\n'))

        expect(names).toContain('SignatureBlock')
        expect(names.filter((name) => !output.includes(`template ${name}`))).toEqual([])
      })

      it('reaches the original through the shared import when a component of the same name wraps it', async() => {
        const template = await scaffold('extend-template', [
          ['Template.svelte', shell],
          [
            'components/SignatureBlock.svelte',
            [
              '<script>',
              '  import { SignatureBlock } from \'@cenk1cenk2/md-printer/components\'',
              '</script>',
              '',
              '<section class="wrapped-signature">',
              '  <SignatureBlock signature={{ date: \'2026-01-01\', name: \'Mock Signer\' }}>',
              '    {#snippet children(signature)}<p class="consumer-block">signed by {signature.name} on {signature.date}</p>{/snippet}',
              '  </SignatureBlock>',
              '</section>',
              '<section class="bare-signature"><SignatureBlock signature={{ date: \'2026-01-01\', name: \'Bare Signer\' }} /></section>',
              ''
            ].join('\n')
          ],
          [
            'components/Translate.svelte',
            [
              '<script>',
              '  import { Translate } from \'@cenk1cenk2/md-printer/components\'',
              '',
              '  let props = $props()',
              '</script>',
              '',
              '<em class="wrapped-translate"><Translate {...props} /></em>',
              ''
            ].join('\n')
          ],
          ['i18n/en.yaml', 'present: Here\n']
        ])

        const output = await html(template, '::signature-block\n\n::translate{key="present"}\n')

        // the consumer draws the block from the signature it is handed, and without a snippet nothing is drawn
        expect(output).toMatch(/<section class="wrapped-signature">[\s\S]*<p class="consumer-block">signed by Mock Signer on 2026-01-01<\/p>/)
        expect(output).not.toContain('Bare Signer')
        expect(output).not.toContain('Digitally signed')
        expect(output).toMatch(/<em class="wrapped-translate">(<!--[^>]*-->)*Here/)
      })

      it('leaves the signature block empty as a directive without a signature', async() => {
        const output = await html(await scaffold('unsigned-template', [['Template.svelte', shell]]), '# Unsigned\n\n::signature-block\n')

        expect(output).toContain('Unsigned')
        expect(output).not.toContain('Digitally signed')
      })
    })

    describe('template layout', () => {
      const shell = [
        '<script>',
        '  import { Markdown, Translate, getExtension } from \'@cenk1cenk2/md-printer/components\'',
        '',
        '  const { greet } = getExtension()',
        '</script>',
        '',
        '<p class="extension">{greet()}</p>',
        '<p class="translation"><Translate key="word" /></p>',
        '<Markdown />',
        ''
      ].join('\n')

      const parts = (from: string): Record<'component' | 'extension' | 'i18n', string> => ({
        component: `<p class="component">component from ${from}</p>\n`,
        extension: `export const greet = (): string => 'extension from ${from}'\n`,
        i18n: `word: translation from ${from}\n`
      })

      const expectFrom = async(template: string, from: string): Promise<void> => {
        const output = await html(template, '::part\n')

        expect(output).toContain(`extension from ${from}`)
        expect(output).toContain(`translation from ${from}`)
        expect(output).toContain(`component from ${from}`)
      }

      it('reads the default layout', async() => {
        const { component, extension, i18n } = parts('default')
        const template = await scaffold('layout-default', [
          ['template/Template.svelte', shell],
          ['template/components/Part.svelte', component],
          ['src/extension.ts', 'export { greet } from \'./greet.js\'\n'],
          ['src/greet.ts', extension],
          ['i18n/en.yaml', i18n]
        ])

        await expectFrom(template, 'default')
      })

      it('reads the paths of a files section, ignoring the default locations', async() => {
        const { component, extension, i18n } = parts('custom')
        const stale = parts('stale')
        const template = await scaffold('layout-custom', [
          [
            'settings.json',
            JSON.stringify({
              files: {
                template: 'views/Main.svelte',
                components: 'views/parts',
                extension: 'lib/functions.ts',
                i18n: 'locales'
              }
            })
          ],
          ['views/Main.svelte', shell],
          ['views/parts/Part.svelte', component],
          ['lib/functions.ts', extension],
          ['locales/en.yaml', i18n],
          ['template/Template.svelte', '<p>stale template</p>\n'],
          ['template/components/Part.svelte', stale.component],
          ['src/extension.ts', stale.extension],
          ['i18n/en.yaml', stale.i18n]
        ])

        await expectFrom(template, 'custom')
      })

      it('reads several components folders in order, a later folder replacing a component of the same name', async() => {
        const { extension, i18n } = parts('folders')
        const template = await scaffold('layout-components-folders', [
          ['settings.json', JSON.stringify({ files: { components: ['parts/shared', 'parts/own'] } })],
          ['template/Template.svelte', shell],
          ['parts/shared/Part.svelte', parts('shared').component],
          ['parts/shared/Extra.svelte', '<p class="extra">extra from shared</p>\n'],
          ['parts/own/Part.svelte', parts('own').component],
          ['src/extension.ts', extension],
          ['i18n/en.yaml', i18n]
        ])

        const output = await html(template, '::part\n\n::extra\n')

        expect(output).toContain('component from own')
        expect(output).not.toContain('component from shared')
        expect(output).toContain('extra from shared')
      })

      it('merges several i18n folders in order, a later folder replacing a key and nested keys merging', async() => {
        const { component, extension } = parts('locales')
        const template = await scaffold('layout-i18n-folders', [
          ['settings.json', JSON.stringify({ files: { i18n: ['locales/shared', 'locales/own'] } })],
          [
            'template/Template.svelte',
            [
              '<script>',
              '  import { Markdown, Translate } from \'@cenk1cenk2/md-printer/components\'',
              '</script>',
              '',
              '<p class="word"><Translate key="word" /></p>',
              '<p class="kept"><Translate key="group.kept" /></p>',
              '<p class="replaced"><Translate key="group.replaced" /></p>',
              '<Markdown />',
              ''
            ].join('\n')
          ],
          ['template/components/Part.svelte', component],
          ['src/extension.ts', extension],
          ['locales/shared/en.yaml', 'word: word from shared\ngroup:\n  kept: kept from shared\n  replaced: replaced from shared\n'],
          ['locales/own/en.yaml', 'word: word from own\ngroup:\n  replaced: replaced from own\n']
        ])

        const output = await html(template, '# Locales\n')

        expect(output).toContain('word from own')
        expect(output).toContain('kept from shared')
        expect(output).toContain('replaced from own')
        expect(output).not.toContain('word from shared')
        expect(output).not.toContain('replaced from shared')
      })

      it('merges several extension modules in order, a later module replacing an export of the same name', async() => {
        const template = await scaffold('layout-extension-modules', [
          ['settings.json', JSON.stringify({ files: { extension: ['src/shared.ts', 'src/own.mjs'] } })],
          ['template/Template.svelte', shell],
          [
            'template/components/Part.svelte',
            '<script>\n  import { getExtension } from \'@cenk1cenk2/md-printer/components\'\n\n  const { only } = getExtension()\n</script>\n\n<p class="only">{only()}</p>\n'
          ],
          ['src/shared.ts', 'export const greet = (): string => \'extension from shared\'\nexport const only = (): string => \'only in shared\'\n'],
          ['src/own.mjs', 'export const greet = () => \'extension from own\'\n'],
          ['i18n/en.yaml', parts('modules').i18n]
        ])

        const output = await html(template, '::part\n')

        expect(output).toContain('extension from own')
        expect(output).not.toContain('extension from shared')
        expect(output).toContain('only in shared')
      })

      it('falls back to the root locations of 3.x', async() => {
        const { component, extension, i18n } = parts('legacy')
        const template = await scaffold('layout-legacy', [
          ['Template.svelte', shell],
          ['components/Part.svelte', component],
          ['extension.ts', extension],
          ['i18n/en.yaml', i18n]
        ])

        await expectFrom(template, 'legacy')
      })

      it('falls back per key and prefers the default location', async() => {
        const { component, extension, i18n } = parts('mixed')
        const stale = parts('stale')
        const template = await scaffold('layout-mixed', [
          ['template/Template.svelte', shell],
          ['Template.svelte', '<p>stale template</p>\n'],
          ['components/Part.svelte', component],
          ['src/extension.ts', extension],
          ['extension.ts', stale.extension],
          ['i18n/en.yaml', i18n]
        ])

        await expectFrom(template, 'mixed')
      })

      it.each(['template', 'components', 'extension', 'i18n'])('fails on a missing %s path without falling back, naming the path', async(key) => {
        const { component, extension, i18n } = parts('legacy')
        const template = await scaffold(`layout-missing-${key}`, [
          ['settings.json', JSON.stringify({ files: { [key]: 'not/here' } })],
          ['Template.svelte', shell],
          ['components/Part.svelte', component],
          ['extension.ts', extension],
          ['i18n/en.yaml', i18n]
        ])

        await expect(html(template, '# Missing\n')).rejects.toThrow(new RegExp(`files\\.${key} to a path that does not exist: ${join(template, 'not', 'here')}`))
      })

      it.each(['../outside', 'link'])('fails on the path %s leaving the template', async(path) => {
        const template = await scaffold(`layout-escape-${path.replace(/\W/g, '')}`, [
          ['settings.json', JSON.stringify({ files: { template: `${path}/Template.svelte` } })],
          ['template/Template.svelte', shell]
        ])

        await scaffold(join(template, '..', 'outside').slice(directory.length + 1), [['Template.svelte', '<p>from outside</p>\n']])
        await symlink(join(template, '..', 'outside'), join(template, 'link'))

        await expect(html(template, '# Escape\n')).rejects.toThrow(/files\.template outside of the template directory/)
      })

      it('fails on an unknown key in the files section', async() => {
        const template = await scaffold('layout-unknown', [
          ['settings.json', JSON.stringify({ files: { templates: 'views/Main.svelte' } })],
          ['template/Template.svelte', shell]
        ])

        await expect(html(template, '# Unknown\n')).rejects.toThrow(/Template settings are invalid in .*settings\.json: files: Unrecognized key: "templates"/)
      })

      it('fails naming both locations when there is no template file', async() => {
        const template = await scaffold('layout-empty', [['settings.json', '{}']])

        await expect(html(template, '# Empty\n')).rejects.toThrow(/Template does not exist, expected template\/Template\.svelte or Template\.svelte in: /)
      })
    })

    describe('extension module', () => {
      const shell = [
        '<script lang="ts">',
        '  import { Markdown, getExtension } from \'@cenk1cenk2/md-printer/components\'',
        '',
        '  let { extension } = $props()',
        '',
        '  const typed = getExtension<{ greet: (name: string) => string }>()',
        '</script>',
        '',
        '<p class="prop">{extension.greet(\'prop\')}</p>',
        '<p class="helper">{typed.greet(\'helper\')}</p>',
        '<p class="keys">{Object.keys(extension).join(\',\')}</p>',
        '<Markdown />',
        ''
      ].join('\n')

      const component: [string, string] = [
        'components/Greeting.svelte',
        [
          '<script>',
          '  import { getContext } from \'svelte\'',
          '',
          '  const { greet } = getContext(\'md-printer:extension\')',
          '</script>',
          '',
          '<p class="context">{greet(\'component\')}</p>',
          ''
        ].join('\n')
      ]

      const esm = (from: string): string => `export function greet(name: string): string {\n  return \`${from} \${name}\`\n}\n\nexport default 'left out'\n`

      it('exposes a typescript module as the prop, the helper and the context', async() => {
        const output = await html(await scaffold('extension-ts', [['Template.svelte', shell], component, ['extension.ts', esm('ts')]]), '::greeting\n')

        expect(output).toContain('ts prop')
        expect(output).toContain('ts helper')
        expect(output).toContain('ts component')
        expect(output).toContain('<p class="keys">greet</p>')
      })

      it('resolves the imports of the module from the node_modules of the template', async() => {
        const template = await scaffold('extension-dependency', [
          ['Template.svelte', shell],
          ['extension.ts', 'import { word } from \'local-kit\'\n\nexport const greet = (name: string): string => `${word} ${name}`\n'],
          [
            'node_modules/local-kit/package.json',
            JSON.stringify({
              name: 'local-kit',
              main: 'index.js',
              type: 'module'
            })
          ],
          ['node_modules/local-kit/index.js', 'export const word = \'from local-kit\'\n']
        ])

        expect(await html(template, '# Dependency\n')).toContain('from local-kit prop')
      })

      it.each([
        ['extension.mts', esm('mts')],
        ['extension.cts', esm('cts')],
        ['extension.js', 'export const greet = (name) => `js ${name}`\n'],
        ['extension.mjs', 'export const greet = (name) => `mjs ${name}`\n'],
        ['extension.cjs', 'const { basename } = require(\'node:path\')\n\nmodule.exports = { greet: (name) => `cjs ${basename(name)}` }\n']
      ])('loads %s', async(file, content) => {
        const output = await html(
          await scaffold(`extension-${file.replace('.', '-')}`, [
            ['Template.svelte', shell],
            [file, content]
          ]),
          '# Module\n'
        )

        expect(output).toContain(`${file.split('.')[1]} prop`)
        expect(output).toContain('<p class="keys">greet</p>')
      })

      it('fails on more than one module, naming the files', async() => {
        const template = await scaffold('extension-two', [
          ['Template.svelte', shell],
          ['extension.ts', esm('ts')],
          ['extension.cjs', 'exports.greet = () => \'cjs\'\n']
        ])

        await expect(html(template, '# Two\n')).rejects.toThrow(/more than one extension module, keep one of extension\.ts, extension\.cjs/)
      })

      it('gives an empty extension to a template without a module', async() => {
        const template = await scaffold('extension-none', [
          [
            'Template.svelte',
            [
              '<script>',
              '  import { getExtension } from \'@cenk1cenk2/md-printer/components\'',
              '',
              '  let { extension } = $props()',
              '</script>',
              '',
              '<p class="count">{Object.keys(extension).length}/{Object.keys(getExtension()).length}</p>',
              ''
            ].join('\n')
          ]
        ])

        expect(await html(template, '# None\n')).toContain('<p class="count">0/0</p>')
      })

      it('does not offer the helper as a directive', async() => {
        const template = await scaffold('extension-directive', [
          ['Template.svelte', '<script>\n  import { Markdown } from \'@cenk1cenk2/md-printer/components\'\n</script>\n\n<Markdown />\n']
        ])

        expect(await html(template, '::get-extension\n')).toContain('::get-extension')
      })
    })

    describe('Translate', () => {
      let template: string

      beforeAll(async() => {
        template = await scaffold('translate-template', [
          [
            'Template.svelte',
            [
              '<script>',
              '  import { Markdown, Translate } from \'@cenk1cenk2/md-printer/components\'',
              '</script>',
              '',
              '<Markdown />',
              '<p class="known"><Translate key="present" /></p>',
              '<p class="fallback"><Translate key="absent" fallback="Not there" /></p>',
              '<p class="key"><Translate key="absent" /></p>',
              ''
            ].join('\n')
          ],
          ['i18n/en.yaml', 'present: Here\n'],
          ['i18n/de.yaml', 'present: Anwesend\n']
        ])
      })

      const marker = '(<!--[^>]*-->)*'

      it('translates in a template with a fallback or the key for a missing key, without a wrapper', async() => {
        const output = await html(template, '# Translate\n')

        expect(output).toMatch(new RegExp(`<p class="known">${marker}Here${marker}</p>`))
        expect(output).toMatch(new RegExp(`<p class="fallback">${marker}Not there${marker}</p>`))
        expect(output).toMatch(new RegExp(`<p class="key">${marker}absent${marker}</p>`))
      })

      it('translates directives in the selected language, inside paragraphs and table cells', async() => {
        const output = await html(template, '::translate{key="present"}\n\nIn text :translate{key="present"} here.\n\n| Head |\n| --- |\n| :translate{key="present"} |\n', [
          '-l',
          'de'
        ])

        expect(output).toMatch(new RegExp(`<p>${marker}In text ${marker}Anwesend${marker} here.${marker}</p>`))
        expect(output).toMatch(new RegExp(`<td>${marker}Anwesend${marker}</td>`))
      })
    })

    describe('Localized', () => {
      let template: string

      beforeAll(async() => {
        template = await scaffold('localized-template', [
          [
            'Template.svelte',
            [
              '<script>',
              '  import { Markdown, Localized } from \'@cenk1cenk2/md-printer/components\'',
              '</script>',
              '',
              '<Markdown />',
              '<p class="snippet"><Localized>{#snippet de()}<b>Fett</b>{/snippet}{#snippet en()}<b>Bold</b>{/snippet}</Localized></p>',
              ''
            ].join('\n')
          ]
        ])
      })

      const marker = '(<!--[^>]*-->)*'
      const markdown = 'In text :localized{en="Invoice" de="Rechnung" fallback="Bill"} here.\n\n| Head |\n| --- |\n| :localized{en="Total" de="Summe"} |\n'

      it.each([
        ['en', 'Invoice', 'Total', 'Bold'],
        ['de', 'Rechnung', 'Summe', 'Fett'],
        ['de-AT', 'Rechnung', 'Summe', 'Fett']
      ])('picks the text of the language %s, inline and in table cells, without a wrapper', async(language, text, cell, snippet) => {
        const output = await html(template, markdown, ['-l', language])

        expect(output).toMatch(new RegExp(`<p>${marker}In text ${marker}${text}${marker} here.${marker}</p>`))
        expect(output).toMatch(new RegExp(`<td>${marker}${cell}${marker}</td>`))
        expect(output).toMatch(new RegExp(`<p class="snippet">${marker}<b>${snippet}</b>${marker}</p>`))
      })

      it('takes the fallback for a language it does not list, otherwise nothing', async() => {
        const output = await html(template, markdown, ['-l', 'tr'])

        expect(output).toMatch(new RegExp(`<p>${marker}In text ${marker}Bill${marker} here.${marker}</p>`))
        expect(output).toMatch(new RegExp(`<td>${marker}</td>`))
      })
    })
  })

  describe('attachments', () => {
    let attachments: string

    beforeAll(async() => {
      attachments = join(directory, 'attachments')

      await mkdir(attachments)
      await run(['--stdin', join(attachments, 'reference.pdf')], '# Reference\n\n::pagebreak\n\n# Reference, page two\n')
    })

    const render = async(frontmatter: string, args: string[] = []): Promise<Buffer> => {
      const input = join(attachments, 'document.md')

      await writeFile(input, `---\n${frontmatter}\n---\n\n# Document\n`)

      return run([input, '-O', ...args])
    }

    it('merges the attachments of the front-matter into the PDF', async() => {
      const pdf = await render(
        ['attachments:', '  - file: ./reference.pdf', '    position: before', '  - file: ./reference.pdf', '    compress: true', 'compress: true'].join('\n')
      )

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pages(pdf)).toBe(5)
    })

    it('rejects an invalid position', async() => {
      await expect(render(['attachments:', '  - file: ./reference.pdf', '    position: middle'].join('\n'))).rejects.toThrow(/invalid position: middle/)
    })

    it('rejects attachments for HTML output', async() => {
      await expect(render(['attachments:', '  - file: ./reference.pdf'].join('\n'), ['-F', 'html'])).rejects.toThrow(/only supported for PDF output/)
    })
  })

  describe('input validation', () => {
    /**
     * Runs the built CLI expecting it to fail, resolving with its exit code and the lines it wrote to stderr.
     */
    function fail(args: string[], input?: string): Promise<{ code: number | null; lines: string[] }> {
      return new Promise((resolve, reject) => {
        const child = execFile(process.execPath, [join(root, 'bin', 'run.js'), ...args], { cwd: root }, (err, _stdout, stderr) =>
          err ? resolve({ code: child.exitCode, lines: stderr.split('\n').filter(Boolean) }) : reject(new Error('Expected the command to fail.'))
        )

        child.stdin.end(input ?? '')
      })
    }

    it('rejects --stdout with --preview', async() => {
      await expect(fail([join('test', 'default.md'), '--stdout', '--preview'])).resolves.toEqual({
        code: 2,
        lines: [expect.stringContaining('Writing to stdout is not supported with --preview.')]
      })
    })

    it('rejects an unknown output file type', async() => {
      await expect(fail([join('test', 'default.md'), '-O', '-F', 'docx'])).resolves.toEqual({
        code: 2,
        lines: [expect.stringMatching(/output-filetype.*"pdf"\|"html"/)]
      })
    })

    it('rejects --stdin with both a file and an output argument', async() => {
      await expect(fail(['--stdin', join('test', 'default.md'), 'output.pdf'], '# Stdin\n')).resolves.toEqual({
        code: 2,
        lines: [expect.stringContaining('Reading from --stdin takes only the output file argument.')]
      })
    })

    it('rejects a missing input', async() => {
      await expect(fail([])).resolves.toEqual({
        code: 2,
        lines: [expect.stringContaining('Either --stdin or file argument must be provided.')]
      })
    })
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

  it('keeps code samples in HTML output untouched', async() => {
    const input = join(directory, 'code', 'input.md')

    await mkdir(join(directory, 'code'), { recursive: true })
    await copyFile(join(root, 'test', 'assets', 'landscape.svg'), join(directory, 'code', 'x.svg'))
    await writeFile(input, 'Inline `url(x.svg)` here.\n\n```\n<img src="x.svg">\n```\n\n![image](x.svg)\n')

    const html = (await run([input, '-F', 'html', '-O'])).toString()

    expect(html).toContain('<code>url(x.svg)</code>')
    expect(html).toContain('&lt;img src="x.svg">')
    expect(html).toMatch(/<img src="data:image\/svg\+xml;base64,[^"]+" alt="image">/)
  })

  it('keeps the file mode of an existing output', async() => {
    const output = join(directory, 'private.html')

    await writeFile(output, '')
    await chmod(output, 0o600)
    await run(['--stdin', '-F', 'html', output], '# Private\n')

    expect(((await stat(output)).mode % 0o1000).toString(8)).toBe('600')
    expect(await readFile(output, 'utf8')).toContain('Private')
  })

  it('starts a new page at the shared PageBreak component as ::page-break', async() => {
    expect(pages(await run(['--stdin', '-O'], '# One\n\n::page-break\n\n# Two\n'))).toBe(2)
  })

  describe('markdown components', () => {
    let template: string

    const markdown = [
      '---',
      'who: Ada',
      '---',
      '',
      '::callout{type="info"}',
      '',
      ':::callout{type="warn"}',
      'Some **bold** text',
      ':::',
      '',
      '- one :items[**two**]{count="3"} three',
      '',
      '::title',
      '',
      'Meet at 10:30am. ::nope',
      '',
      '::nope{a="1"}',
      ''
    ].join('\n')

    beforeAll(async() => {
      template = join(directory, 'components-template')

      await mkdir(join(template, 'components'), { recursive: true })
      await writeFile(join(template, 'Template.svelte'), '<script>\n  import { Markdown } from \'@cenk1cenk2/md-printer/components\'\n</script>\n\n<Markdown />\n')
      await writeFile(
        join(template, 'components', 'Callout.svelte'),
        [
          '<script>',
          '  import { getContext } from \'svelte\'',
          '',
          '  let { type, children } = $props()',
          '',
          '  const { data } = getContext(\'md-printer:document\')',
          '</script>',
          '',
          '<aside class="callout" data-type="{typeof type}:{type}">{data.who}: {@render children?.()}</aside>',
          ''
        ].join('\n')
      )
      await writeFile(
        join(template, 'components', 'Items.svelte'),
        '<script>\n  let { count, children } = $props()\n</script>\n\n<span class="items" data-count="{typeof count}:{count}">{@render children?.()}</span>\n'
      )
      await writeFile(join(template, 'components', 'Title.svelte'), '<h2 class="template-title">From the template</h2>\n')
    })

    it('renders leaf, container and inline directives through the template components', async() => {
      const html = (await run(['--stdin', '-O', '-F', 'html', '-t', template], markdown)).toString()

      expect(html).toMatch(/<aside class="callout" data-type="string:info">Ada: (<!--[^>]*-->)*<\/aside>/)
      expect(html).toMatch(/<aside class="callout" data-type="string:warn">Ada: (<!--[^>]*-->)*<p>Some <strong>bold<\/strong> text<\/p>/)
      expect(html).toMatch(/<li>(<!--[^>]*-->)*one (<!--[^>]*-->)*<span class="items" data-count="string:3">(<!--[^>]*-->)*<strong>two<\/strong>/)
      expect(html).toContain('<h2 class="template-title">From the template</h2>')
    })

    it('keeps directives without a component as written', async() => {
      const html = (await run(['--stdin', '-O', '-F', 'html', '-t', template], markdown)).toString()

      expect(html).toContain('<p>Meet at 10:30am. ::nope</p>')
      expect(html).toContain('<p>::nope{a="1"}</p>')
    })

    it('renders the components into content for templates that place it with {@html content}', async() => {
      const raw = join(directory, 'raw-content-template')

      await mkdir(raw)
      await symlink(join(template, 'components'), join(raw, 'components'))
      await writeFile(join(raw, 'Template.svelte'), '<script>\n  let { content } = $props()\n</script>\n\n<main>{@html content}</main>\n')

      const html = (await run(['--stdin', '-O', '-F', 'html', '-t', raw], markdown)).toString()

      expect(html).toMatch(/<aside class="callout" data-type="string:warn">Ada: (<!--[^>]*-->)*<p>Some <strong>bold<\/strong> text<\/p>/)
      expect(html).toContain('<p>::nope{a="1"}</p>')
    })
  })
})
