import { readFile } from 'fs/promises'
import mime from 'mime'
import { isAbsolute, resolve } from 'path'

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
 * Replaces local `url()` references in CSS and `src` attributes in HTML with data URIs.
 * Remote references are fetched as well when `remote` is set, which Chrome's isolated header/footer templates need.
 */
export async function inlineAssets(markup: string, base: string, remote = false): Promise<string> {
  const cache = new Map<string, Promise<string | undefined>>()

  let result = ''
  let position = 0

  for (const entry of await Promise.all(
    [...markup.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)|(\ssrc=)(['"])([^'"]+)\4/g)].map(async(match) => {
      const reference = match[2] ?? match[5]
      const inlined = await (cache.get(reference) ?? cache.set(reference, load(reference, base, remote)).get(reference))

      if (!inlined) {
        return undefined
      }

      return { match, replacement: match[2] ? `url("${inlined}")` : `${match[3]}"${inlined}"` }
    })
  )) {
    if (!entry) {
      continue
    }

    result += markup.slice(position, entry.match.index) + entry.replacement
    position = entry.match.index + entry.match[0].length
  }

  return result + markup.slice(position)
}

async function load(reference: string, base: string, remote: boolean): Promise<string | undefined> {
  if (reference.startsWith('data:') || reference.startsWith('#')) {
    return undefined
  }

  if (/^https?:\/\//.test(reference)) {
    if (!remote) {
      return undefined
    }

    const response = await fetch(reference)

    if (!response.ok) {
      return undefined
    }

    return `data:${response.headers.get('content-type') ?? mimeType(new URL(reference).pathname)};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`
  }

  const path = reference.startsWith('file://') ? new URL(reference).pathname : isAbsolute(reference) ? reference : resolve(base, decodeURI(reference.split(/[?#]/)[0]))

  if (!isInlinableAsset(path)) {
    return undefined
  }

  return readFile(path).then(
    (content) => dataUri(path, content),
    (): undefined => undefined
  )
}
