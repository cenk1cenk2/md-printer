import { readFile, realpath } from 'fs/promises'
import { fromHtml } from 'hast-util-from-html'
import { toHtml } from 'hast-util-to-html'
import type { ImportDependency, UrlDependency } from 'lightningcss'
import { transform, transformStyleAttribute } from 'lightningcss'
import mime from 'mime'
import { isAbsolute, relative, sep } from 'path'
import { parseSrcset, stringifySrcset } from 'srcset'
import { visit } from 'unist-util-visit'
import { fileURLToPath, pathToFileURL } from 'url'

import type { AssetInliner, InlineAssetsOptions, InlinedAsset, InlinedAssets } from '@interfaces'

// the attributes a page loads an image from, so text, code samples and links stay untouched
const REFERENCES: Record<string, string[]> = {
  img: ['src', 'srcSet'],
  source: ['src', 'srcSet'],
  input: ['src'],
  video: ['poster'],
  image: ['href', 'xLinkHref']
}

export function mimeType(path: string): string {
  return mime.getType(path) ?? 'application/octet-stream'
}

/**
 * Images and fonts, the assets that can be embedded into a page as data URIs.
 */
export function isInlinableAsset(path: string): boolean {
  return /^(image|font)\//.test(mime.getType(path) ?? '')
}

export function dataUri(path: string, content: Buffer): string {
  return `data:${mimeType(path)};base64,${content.toString('base64')}`
}

/**
 * Resolves symlinks first, so a link inside the directory can not reach a file outside of it.
 */
export async function resolveConfined(path: string, base: string): Promise<string | undefined> {
  const [real, root] = await Promise.all([realpath(path), realpath(base)]).catch((): string[] => [])

  if (!real) {
    return undefined
  }

  const rel = relative(root, real)

  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? undefined : real
}

/**
 * Replaces local image references in HTML with data URIs: the image attributes, `style` attributes and `<style>` elements.
 * Remote references are fetched as well when `remote` is set, which Chrome's isolated header/footer templates need.
 * Document content is `confined` to its directory, the same rule the PDF renderer applies to the assets a page loads.
 */
export async function inlineHtml(markup: string, base: string, options: InlineAssetsOptions = {}): Promise<InlinedAssets> {
  const assets = new Set<string>()
  const inline = inliner(base, options, assets)
  const tree = fromHtml(markup, { fragment: !/^<!doctype/i.test(markup) })
  const pending: Promise<void>[] = []

  visit(tree, 'element', (node) => {
    const { properties } = node

    for (const name of REFERENCES[node.tagName] ?? []) {
      const value = properties[name]

      if (typeof value !== 'string') {
        continue
      }

      pending.push(
        (async(): Promise<void> => {
          properties[name] =
            name === 'srcSet'
              ? stringifySrcset(await Promise.all(parseSrcset(value).map(async(candidate) => ({ ...candidate, url: (await inline(candidate.url)) ?? candidate.url }))))
              : ((await inline(value)) ?? value)
        })()
      )
    }

    if (typeof properties.style === 'string') {
      const style = properties.style

      pending.push(
        stylesheet(style, inline, true).then((css): void => {
          properties.style = css
        })
      )
    }

    if (node.tagName === 'style') {
      for (const child of node.children) {
        if (child.type === 'text') {
          pending.push(
            stylesheet(child.value, inline).then((css): void => {
              child.value = css
            })
          )
        }
      }
    }
  })

  await Promise.all(pending)

  return { content: toHtml(tree, { characterReferences: { useNamedReferences: true } }), assets: [...assets] }
}

/**
 * Replaces local `url()` references in CSS with data URIs, with the same options as `inlineHtml`.
 */
export async function inlineCss(css: string, base: string, options: InlineAssetsOptions = {}): Promise<InlinedAssets> {
  const assets = new Set<string>()

  return { content: await stylesheet(css, inliner(base, options, assets)), assets: [...assets] }
}

function inliner(base: string, { remote = false, confined = false, cache = new Map() }: InlineAssetsOptions, assets: Set<string>): AssetInliner {
  return async(reference) => {
    const asset = await (cache.get(reference) ?? cache.set(reference, load(reference, base, remote, confined)).get(reference))

    if (asset?.path) {
      assets.add(asset.path)
    }

    return asset?.uri
  }
}

async function stylesheet(css: string, inline: AssetInliner, attribute = false): Promise<string> {
  const options = {
    filename: 'style.css',
    code: Buffer.from(css),
    analyzeDependencies: { preserveImports: true },
    errorRecovery: true
  }
  const { code, dependencies } = attribute ? transformStyleAttribute({ ...options, analyzeDependencies: true }) : transform(options)

  // lightningcss swaps every reference for a placeholder, which also keeps a matching string elsewhere in the stylesheet untouched,
  // and only types the dependencies as possibly missing for when the analysis is off
  const replacements = await Promise.all(
    (dependencies as (ImportDependency | UrlDependency)[]).map(async(dependency) => [
      `"${dependency.placeholder}"`,
      JSON.stringify((dependency.type === 'url' && (await inline(dependency.url))) || dependency.url)
    ])
  )

  return replacements.reduce((result, [placeholder, value]) => result.replace(placeholder, () => value), code.toString())
}

async function load(reference: string, base: string, remote: boolean, confined: boolean): Promise<InlinedAsset | undefined> {
  const url = reference.startsWith('#') ? undefined : URL.parse(reference, pathToFileURL(`${base}${sep}`))

  if (url?.protocol === 'http:' || url?.protocol === 'https:') {
    if (!remote) {
      return undefined
    }

    // an unreachable asset leaves the reference in place instead of failing the whole document, for example when offline
    const response = await fetch(url).catch((): undefined => undefined)

    if (!response?.ok) {
      return undefined
    }

    return { uri: `data:${response.headers.get('content-type') ?? mimeType(url.pathname)};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}` }
  }

  if (url?.protocol !== 'file:' || url.host) {
    return undefined
  }

  const path = fileURLToPath(url)
  const file = confined ? await resolveConfined(path, base) : path

  if (!file || !isInlinableAsset(path)) {
    return undefined
  }

  return readFile(file).then(
    (content) => ({ uri: dataUri(path, content), path: file }),
    (): undefined => undefined
  )
}
