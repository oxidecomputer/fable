import { nanoid } from 'nanoid'
import * as Y from 'yjs'

import { parsePage } from '../content/markdown'
import { compileTemplate } from './compile'
import {
  LOCAL_ORIGIN,
  applyTextDiff,
  getMetaMap,
  getOrderArray,
  getPagesMap,
  getTemplatesMap,
  makePageMap,
} from './doc'

/**
 * Pure operations on a deck Y.Doc, used by the MCP server (which fetches the
 * room doc, applies an op, and sends the diff back). Every mutation validates
 * first and throws OpError with an agent-readable message on bad input.
 */

export class OpError extends Error {}

export function nextPageFilename(existing: string[]): string {
  const used = new Set(existing)
  if (!used.has('untitled.md')) return 'untitled.md'
  let n = 2
  while (used.has(`untitled-${n}.md`)) n += 1
  return `untitled-${n}.md`
}

export type SlideInfo = {
  pageId: string
  index: number
  filename: string
  template: string
  title: string | null
  parseError: string | null
}

export function listSlides(ydoc: Y.Doc): { title: string | null; slides: SlideInfo[] } {
  const meta = getMetaMap(ydoc)
  const order = getOrderArray(ydoc)
  const pages = getPagesMap(ydoc)

  const slides = order
    .toArray()
    .filter((id) => pages.has(id))
    .map((pageId, index) => {
      const page = pages.get(pageId)!
      const source = (page.get('source') as Y.Text | undefined)?.toString() ?? ''
      const filename = typeof page.get('filename') === 'string' ? page.get('filename') : ''
      let template = ''
      let title: string | null = null
      let parseError: string | null = null
      try {
        const data = parsePage(source)
        template = String(data.template ?? '')
        title = typeof data.title === 'string' ? data.title : null
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e)
      }
      return { pageId, index, filename, template, title, parseError }
    })

  const title = meta.get('title')
  return { title: typeof title === 'string' ? title : null, slides }
}

function getPage(ydoc: Y.Doc, pageId: string): Y.Map<any> {
  const page = getPagesMap(ydoc).get(pageId)
  if (!page) throw new OpError(`No slide with pageId "${pageId}" — use list_slides`)
  return page
}

export function readSlide(ydoc: Y.Doc, pageId: string): string {
  const ytext = getPage(ydoc, pageId).get('source') as Y.Text | undefined
  return ytext?.toString() ?? ''
}

/** Validate a page source, throwing OpError with the parse failure. */
function assertParses(source: string): void {
  try {
    parsePage(source)
  } catch (e) {
    throw new OpError(
      `Source does not parse: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

export function updateSlide(ydoc: Y.Doc, pageId: string, source: string): void {
  assertParses(source)
  const ytext = getPage(ydoc, pageId).get('source') as Y.Text | undefined
  if (!ytext) throw new OpError(`Slide "${pageId}" has no source text`)
  ydoc.transact(() => applyTextDiff(ytext, ytext.toString(), source), LOCAL_ORIGIN)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Pick a filename: explicit > slug of the slide's title > untitled scheme. */
function pickFilename(
  existing: string[],
  source: string,
  explicit: string | undefined,
): string {
  const used = new Set(existing)
  let base = ''
  if (explicit) {
    base = slugify(path_basename_noext(explicit))
    if (!base) throw new OpError(`Invalid filename "${explicit}"`)
  } else {
    try {
      const data = parsePage(source)
      if (typeof data.title === 'string') base = slugify(data.title)
    } catch {
      /* validated elsewhere */
    }
  }
  if (!base) return nextPageFilename(existing)
  let candidate = `${base}.md`
  let n = 2
  while (used.has(candidate)) candidate = `${base}-${n++}.md`
  return candidate
}

function path_basename_noext(name: string): string {
  const last = name.split('/').pop() ?? name
  return last.replace(/\.md$/, '')
}

export function createSlide(
  ydoc: Y.Doc,
  source: string,
  opts: { atIndex?: number; filename?: string } = {},
): { pageId: string; filename: string } {
  assertParses(source)
  const order = getOrderArray(ydoc)
  const pages = getPagesMap(ydoc)
  const existing = [...pages.values()].map((p) =>
    typeof p.get('filename') === 'string' ? p.get('filename') : '',
  )
  const pageId = nanoid()
  const filename = pickFilename(existing, source, opts.filename)
  ydoc.transact(() => {
    pages.set(pageId, makePageMap(source, filename))
    const index =
      opts.atIndex === undefined
        ? order.length
        : Math.max(0, Math.min(opts.atIndex, order.length))
    order.insert(index, [pageId])
  }, LOCAL_ORIGIN)
  return { pageId, filename }
}

export function deleteSlide(ydoc: Y.Doc, pageId: string): void {
  getPage(ydoc, pageId)
  const order = getOrderArray(ydoc)
  const pages = getPagesMap(ydoc)
  ydoc.transact(() => {
    const i = order.toArray().indexOf(pageId)
    if (i !== -1) order.delete(i, 1)
    pages.delete(pageId)
  }, LOCAL_ORIGIN)
}

export function moveSlide(ydoc: Y.Doc, pageId: string, toIndex: number): void {
  const order = getOrderArray(ydoc)
  const from = order.toArray().indexOf(pageId)
  if (from === -1) throw new OpError(`No slide with pageId "${pageId}"`)
  const to = Math.max(0, Math.min(toIndex, order.length - 1))
  if (from === to) return
  ydoc.transact(() => {
    order.delete(from, 1)
    order.insert(to, [pageId])
  }, LOCAL_ORIGIN)
}

export function setDeckTitle(ydoc: Y.Doc, title: string): void {
  const meta = getMetaMap(ydoc)
  ydoc.transact(() => {
    if (title) meta.set('title', title)
    else meta.delete('title')
  }, LOCAL_ORIGIN)
}

// -- Doc-stored templates ---------------------------------------------------

export function listDocTemplates(ydoc: Y.Doc): string[] {
  return [...getTemplatesMap(ydoc).keys()].sort()
}

export function readDocTemplate(ydoc: Y.Doc, name: string): string {
  const tmap = getTemplatesMap(ydoc).get(name)
  if (!tmap) throw new OpError(`No custom template named "${name}"`)
  return (tmap.get('source') as Y.Text | undefined)?.toString() ?? ''
}

/** Compile-validate template source, throwing OpError so the agent can retry. */
function assertCompiles(source: string): void {
  try {
    compileTemplate(source)
  } catch (e) {
    throw new OpError(`Compile failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export function createDocTemplate(ydoc: Y.Doc, name: string, source: string): void {
  const templates = getTemplatesMap(ydoc)
  if (templates.has(name)) throw new OpError(`Custom template "${name}" already exists`)
  assertCompiles(source)
  ydoc.transact(() => {
    const tmap = new Y.Map<any>()
    const ytext = new Y.Text()
    ytext.insert(0, source)
    tmap.set('source', ytext)
    templates.set(name, tmap)
  }, LOCAL_ORIGIN)
}

export function updateDocTemplate(ydoc: Y.Doc, name: string, source: string): void {
  const tmap = getTemplatesMap(ydoc).get(name)
  if (!tmap) {
    throw new OpError(
      `No custom template named "${name}" — built-in templates are read-only; use create_template to make an editable copy`,
    )
  }
  assertCompiles(source)
  const ytext = tmap.get('source') as Y.Text | undefined
  if (!ytext) throw new OpError(`Template "${name}" has no source text`)
  ydoc.transact(() => applyTextDiff(ytext, ytext.toString(), source), LOCAL_ORIGIN)
}

export function deleteDocTemplate(ydoc: Y.Doc, name: string): void {
  const templates = getTemplatesMap(ydoc)
  if (!templates.has(name)) throw new OpError(`No custom template named "${name}"`)
  ydoc.transact(() => templates.delete(name), LOCAL_ORIGIN)
}
