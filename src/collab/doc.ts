import diff from 'fast-diff'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

import { type PageData, parsePage, serializePage } from '../content/markdown'

/**
 * Yjs document layout (one doc per room = one deck):
 *
 *   meta:      Y.Map    — { title?, config?, theme?, v: 1 }
 *   order:     Y.Array<string>          — page ids
 *   pages:     Y.Map<pageId, Y.Map>     — { source: Y.Text, filename: string }
 *   templates: Y.Map<name, Y.Map>       — { source: Y.Text } (TSX module source)
 *
 * `source` is exactly `serializePage()` output (frontmatter + body), parsed
 * with `parsePage()` on read.
 */

/** Origin tag for local transactions — tracked by the shared UndoManager. */
export const LOCAL_ORIGIN = 'fable-local'

export type DeckMeta = {
  title?: string
  config?: { page_numbers?: boolean }
}
export type DeckContent = DeckMeta & { pages: PageData[] }

export function getMetaMap(ydoc: Y.Doc): Y.Map<any> {
  return ydoc.getMap('meta')
}

export function getOrderArray(ydoc: Y.Doc): Y.Array<string> {
  return ydoc.getArray('order')
}

export function getPagesMap(ydoc: Y.Doc): Y.Map<Y.Map<any>> {
  return ydoc.getMap('pages')
}

export function getTemplatesMap(ydoc: Y.Doc): Y.Map<Y.Map<any>> {
  return ydoc.getMap('templates')
}

export function makePageMap(source: string, filename: string): Y.Map<any> {
  const page = new Y.Map<any>()
  const ytext = new Y.Text()
  ytext.insert(0, source)
  page.set('source', ytext)
  page.set('filename', filename)
  return page
}

/** True when the doc holds no deck data (safe to seed). */
export function isDocEmpty(ydoc: Y.Doc): boolean {
  return (
    getOrderArray(ydoc).length === 0 &&
    getPagesMap(ydoc).size === 0 &&
    getMetaMap(ydoc).size === 0
  )
}

/**
 * Seed a doc from plain content + filenames. When the doc already holds a
 * deck this replaces it wholesale (single transaction).
 */
export function seedDoc(ydoc: Y.Doc, content: DeckContent, filenames: string[]): void {
  ydoc.transact(() => {
    const meta = getMetaMap(ydoc)
    const order = getOrderArray(ydoc)
    const pages = getPagesMap(ydoc)

    for (const key of [...pages.keys()]) pages.delete(key)
    if (order.length > 0) order.delete(0, order.length)
    for (const key of [...meta.keys()]) meta.delete(key)

    meta.set('v', 1)
    if (content.title !== undefined) meta.set('title', content.title)
    if (content.config !== undefined)
      meta.set('config', JSON.parse(JSON.stringify(content.config)))

    content.pages.forEach((page, i) => {
      const id = nanoid()
      pages.set(id, makePageMap(serializePage(page), filenames[i] ?? ''))
      order.push([id])
    })
  }, LOCAL_ORIGIN)
}

/** Encode a fresh doc holding the given deck as a Yjs binary update. */
export function deckToYUpdate(content: DeckContent, filenames: string[]): Uint8Array {
  const ydoc = new Y.Doc()
  seedDoc(ydoc, content, filenames)
  return Y.encodeStateAsUpdate(ydoc)
}

export type ReadDeckResult = {
  content: DeckContent
  filenames: string[]
  pageIds: string[]
}

/**
 * Read a doc back into plain content + filenames. Pages whose source fails
 * to parse throw — callers exporting a live doc should catch and report.
 * Missing/duplicate filenames are fixed up so the result is writable.
 */
export function readDeck(ydoc: Y.Doc): ReadDeckResult {
  const meta = getMetaMap(ydoc)
  const order = getOrderArray(ydoc)
  const pagesMap = getPagesMap(ydoc)

  const pageIds = order.toArray().filter((id) => pagesMap.has(id))
  const pages: PageData[] = []
  const filenames: string[] = []

  for (const id of pageIds) {
    const page = pagesMap.get(id)!
    const source = (page.get('source') as Y.Text | undefined)?.toString() ?? ''
    try {
      pages.push(parsePage(source))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to parse page ${id}: ${msg}`)
    }
    filenames.push(typeof page.get('filename') === 'string' ? page.get('filename') : '')
  }

  const content: DeckContent = { pages }
  const title = meta.get('title')
  if (typeof title === 'string') content.title = title
  const config = meta.get('config')
  if (config && typeof config === 'object') content.config = config

  return { content, filenames: ensureFilenames(filenames), pageIds }
}

export type ReadDeckSourcesResult = {
  meta: DeckMeta
  pageIds: string[]
  filenames: string[]
  /** Raw page sources, verbatim from the doc (may not parse). */
  sources: string[]
  /** Parse errors keyed by filename — informational; sources export anyway. */
  parseErrors: Record<string, string>
}

/**
 * Read a doc's raw page sources for file export. Unlike {@link readDeck},
 * this never throws on a page that doesn't parse — the source is the file
 * content, so it exports verbatim and the error is reported alongside.
 */
export function readDeckSources(ydoc: Y.Doc): ReadDeckSourcesResult {
  const meta = getMetaMap(ydoc)
  const order = getOrderArray(ydoc)
  const pagesMap = getPagesMap(ydoc)

  const pageIds = order.toArray().filter((id) => pagesMap.has(id))
  const sources: string[] = []
  const rawFilenames: string[] = []

  for (const id of pageIds) {
    const page = pagesMap.get(id)!
    sources.push((page.get('source') as Y.Text | undefined)?.toString() ?? '')
    rawFilenames.push(typeof page.get('filename') === 'string' ? page.get('filename') : '')
  }

  const filenames = ensureFilenames(rawFilenames)
  const parseErrors: Record<string, string> = {}
  sources.forEach((source, i) => {
    try {
      parsePage(source)
    } catch (err) {
      parseErrors[filenames[i]] = err instanceof Error ? err.message : String(err)
    }
  })

  const deckMeta: DeckMeta = {}
  const title = meta.get('title')
  if (typeof title === 'string') deckMeta.title = title
  const config = meta.get('config')
  if (config && typeof config === 'object') deckMeta.config = config

  return { meta: deckMeta, pageIds, filenames, sources, parseErrors }
}

/** Fill in missing filenames and dedupe collisions ("untitled.md" scheme). */
export function ensureFilenames(filenames: string[]): string[] {
  const used = new Set<string>()
  return filenames.map((name) => {
    let candidate = name
    if (!candidate || used.has(candidate)) {
      const base = candidate ? candidate.replace(/\.md$/, '') : 'untitled'
      candidate = `${base}.md`
      let n = 2
      while (!candidate || used.has(candidate)) {
        candidate = `${base}-${n}.md`
        n += 1
      }
    }
    used.add(candidate)
    return candidate
  })
}

/**
 * Update `ytext` from `prev` to `next` with minimal splices, so concurrent
 * edits to different parts of the source merge cleanly. `prev` must be the
 * current value of `ytext`.
 */
export function applyTextDiff(ytext: Y.Text, prev: string, next: string): void {
  if (prev === next) return
  let pos = 0
  for (const [op, text] of diff(prev, next)) {
    if (op === diff.EQUAL) {
      pos += text.length
    } else if (op === diff.DELETE) {
      ytext.delete(pos, text.length)
    } else {
      ytext.insert(pos, text)
      pos += text.length
    }
  }
}
