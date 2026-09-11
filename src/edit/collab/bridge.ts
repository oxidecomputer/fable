import { transact } from '@tldraw/state'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

import type { TemplateMap } from '../../Page'
import { compileTemplateCached } from '../../collab/compile'
import {
  LOCAL_ORIGIN,
  applyTextDiff,
  getMetaMap,
  getOrderArray,
  getPagesMap,
  getTemplatesMap,
  makePageMap,
} from '../../collab/doc'
import { parsePage, serializePage } from '../../content/markdown'
import {
  $currentIndex,
  $currentPageId,
  $filenamesById,
  $meta,
  $pageErrors,
  $pageIds,
  $pagesById,
  $templates,
  type Backend,
  type PageData,
  mergePatch,
  nextPageFilename,
} from '../store'
import { setUndoManager } from '../undo'
import { $docTemplateErrors, $docTemplateNames } from './templates-store'

export type CollabBridge = {
  ydoc: Y.Doc
  backend: Backend
  undoManager: Y.UndoManager
  /** y-protocols awareness from the Liveblocks Yjs provider (for yCollab). */
  awareness: unknown
  getPageText(id: string): Y.Text | undefined
  getTemplateText(name: string): Y.Text | undefined
  addTemplate(name: string, source: string): void
  setTemplateSource(name: string, source: string): void
  removeTemplate(name: string): void
  dispose(): void
}

/**
 * Wire a Yjs doc to the tldraw atoms: doc → atoms via observers (with a
 * last-good parse cache so a remote user mid-keystroke can't blank a page),
 * atoms → doc via the returned Backend.
 */
export function connectBridge(
  ydoc: Y.Doc,
  baseTemplates: TemplateMap,
  awareness: unknown,
  deckId?: string,
): CollabBridge {
  const meta = getMetaMap(ydoc)
  const order = getOrderArray(ydoc)
  const pages = getPagesMap(ydoc)
  const templates = getTemplatesMap(ydoc)

  // pageId -> last source string we synced (parse errors included, so we
  // don't reparse unchanged bad sources).
  const sourceCache = new Map<string, string>()

  function syncMeta() {
    const next: { title?: string; config?: { page_numbers?: boolean } } = {}
    const title = meta.get('title')
    if (typeof title === 'string') next.title = title
    const config = meta.get('config')
    if (config && typeof config === 'object') next.config = config
    $meta.set(next)
  }

  function syncOrder() {
    const prevIndex = $currentIndex.get()
    const ids = order.toArray().filter((id) => pages.has(id))
    $pageIds.set(ids)
    const current = $currentPageId.get()
    if (current === null || !ids.includes(current)) {
      $currentPageId.set(ids[Math.min(prevIndex, ids.length - 1)] ?? null)
    }
  }

  function syncPages() {
    const prevById = $pagesById.get()
    const byId: Record<string, PageData> = {}
    const filenamesById: Record<string, string> = {}
    const errors: Record<string, string> = {}

    for (const [id, pmap] of pages.entries()) {
      const ytext = pmap.get('source') as Y.Text | undefined
      const source = ytext?.toString() ?? ''
      const filename = pmap.get('filename')
      filenamesById[id] = typeof filename === 'string' ? filename : ''

      const prevErr = $pageErrors.get()[id]
      if (sourceCache.get(id) === source && prevById[id]) {
        byId[id] = prevById[id]
        if (prevErr) errors[id] = prevErr
        continue
      }
      sourceCache.set(id, source)
      try {
        byId[id] = parsePage(source)
      } catch (err) {
        // Keep the last good parse (remote user may be mid-keystroke).
        byId[id] = prevById[id] ?? { template: '' }
        errors[id] = err instanceof Error ? err.message : String(err)
      }
    }

    for (const id of sourceCache.keys()) {
      if (!pages.has(id)) sourceCache.delete(id)
    }

    $pagesById.set(byId)
    $filenamesById.set(filenamesById)
    $pageErrors.set(errors)
  }

  let scratchTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Mirror doc-template sources to the dev server so Tailwind can scan them
   * (see node/doc-template-scan.ts). No-op in built decks (endpoint absent).
   */
  function pushTemplateSourcesToDev(sources: Record<string, string>) {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return
    if (scratchTimer) clearTimeout(scratchTimer)
    scratchTimer = setTimeout(() => {
      scratchTimer = null
      fetch('/_fable/doc-templates', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deck: deckId ?? 'default', templates: sources }),
      }).catch(() => {})
    }, 500)
  }

  function syncTemplates() {
    const compiled: TemplateMap = {}
    const errors: Record<string, string> = {}
    const names: string[] = []
    const sources: Record<string, string> = {}
    for (const [name, tmap] of templates.entries()) {
      names.push(name)
      const source = (tmap.get('source') as Y.Text | undefined)?.toString() ?? ''
      sources[name] = source
      try {
        compiled[name] = compileTemplateCached(source)
      } catch (err) {
        errors[name] = err instanceof Error ? err.message : String(err)
      }
    }
    $templates.set({ ...baseTemplates, ...compiled })
    $docTemplateErrors.set(errors)
    $docTemplateNames.set(names.sort())
    pushTemplateSourcesToDev(sources)
  }

  function syncAll() {
    transact(() => {
      syncMeta()
      syncPages()
      syncOrder()
      syncTemplates()
    })
  }

  const onMeta = () => syncMeta()
  const onOrder = () => transact(() => syncOrder())
  const onPages = () =>
    transact(() => {
      syncPages()
      syncOrder()
    })
  const onTemplates = () => syncTemplates()

  meta.observe(onMeta)
  order.observe(onOrder)
  pages.observeDeep(onPages)
  templates.observeDeep(onTemplates)
  syncAll()

  const undoManager = new Y.UndoManager([order, pages, meta, templates], {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 500,
  })
  setUndoManager(undoManager)

  function writePageSource(id: string, next: PageData) {
    const pmap = pages.get(id)
    const ytext = pmap?.get('source') as Y.Text | undefined
    if (!ytext) return
    const prev = ytext.toString()
    const nextSource = serializePage(next)
    ydoc.transact(() => applyTextDiff(ytext, prev, nextSource), LOCAL_ORIGIN)
  }

  function currentPageData(id: string): PageData | undefined {
    const pmap = pages.get(id)
    const ytext = pmap?.get('source') as Y.Text | undefined
    if (!ytext) return undefined
    try {
      return parsePage(ytext.toString())
    } catch {
      // Source is transiently unparseable — fall back to the last good parse.
      return $pagesById.get()[id]
    }
  }

  const backend: Backend = {
    updatePage(id, patch) {
      const current = currentPageData(id)
      if (!current) return
      writePageSource(id, mergePatch(current, patch))
    },

    setPage(id, next) {
      writePageSource(id, next)
    },

    addPage(templateName) {
      undoManager.stopCapturing()
      const id = nanoid()
      const filename = nextPageFilename(Object.values($filenamesById.get()))
      ydoc.transact(() => {
        pages.set(id, makePageMap(serializePage({ template: templateName }), filename))
        order.push([id])
      }, LOCAL_ORIGIN)
      $currentPageId.set(id)
    },

    removePage(id) {
      undoManager.stopCapturing()
      ydoc.transact(() => {
        const i = order.toArray().indexOf(id)
        if (i !== -1) order.delete(i, 1)
        if (pages.has(id)) pages.delete(id)
      }, LOCAL_ORIGIN)
    },

    movePage(from, to) {
      undoManager.stopCapturing()
      ydoc.transact(() => {
        if (from < 0 || from >= order.length || to < 0 || to >= order.length) return
        const id = order.get(from)
        order.delete(from, 1)
        order.insert(to, [id])
      }, LOCAL_ORIGIN)
    },

    setTitle(title) {
      ydoc.transact(() => {
        if (title) meta.set('title', title)
        else meta.delete('title')
      }, LOCAL_ORIGIN)
    },

    switchTemplate(id, newTemplate) {
      undoManager.stopCapturing()
      backend.updatePage(id, { template: newTemplate })
    },
  }

  return {
    ydoc,
    backend,
    undoManager,
    awareness,

    getPageText(id) {
      return pages.get(id)?.get('source') as Y.Text | undefined
    },

    getTemplateText(name) {
      return templates.get(name)?.get('source') as Y.Text | undefined
    },

    addTemplate(name, source) {
      undoManager.stopCapturing()
      ydoc.transact(() => {
        if (templates.has(name)) return
        const tmap = new Y.Map<any>()
        const ytext = new Y.Text()
        ytext.insert(0, source)
        tmap.set('source', ytext)
        templates.set(name, tmap)
      }, LOCAL_ORIGIN)
    },

    setTemplateSource(name, source) {
      const ytext = templates.get(name)?.get('source') as Y.Text | undefined
      if (!ytext) return
      undoManager.stopCapturing()
      ydoc.transact(() => applyTextDiff(ytext, ytext.toString(), source), LOCAL_ORIGIN)
    },

    removeTemplate(name) {
      undoManager.stopCapturing()
      ydoc.transact(() => {
        if (templates.has(name)) templates.delete(name)
      }, LOCAL_ORIGIN)
    },

    dispose() {
      setUndoManager(null)
      undoManager.destroy()
      meta.unobserve(onMeta)
      order.unobserve(onOrder)
      pages.unobserveDeep(onPages)
      templates.unobserveDeep(onTemplates)
    },
  }
}
