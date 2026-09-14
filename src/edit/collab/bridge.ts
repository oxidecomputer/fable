import { transact } from '@tldraw/state'
import * as Y from 'yjs'

import { createTemplateCompiler } from '../../collab/compile'
import {
  LOCAL_ORIGIN,
  getMetaMap,
  getOrderArray,
  getPagesMap,
  getTemplatesMap,
  readTemplateSources,
} from '../../collab/doc'
import * as commands from '../../collab/ops'
import { parsePage, serializePage } from '../../content/markdown'
import type { DeckMeta, PageData, TemplateExports, TemplateMap } from '../../model'
import { resolveTemplates } from '../../templates/registry'
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
  templateExports?: TemplateExports,
): CollabBridge {
  const meta = getMetaMap(ydoc)
  const order = getOrderArray(ydoc)
  const pages = getPagesMap(ydoc)
  const templates = getTemplatesMap(ydoc)
  const compiler = createTemplateCompiler(templateExports)

  // pageId -> last source string we synced (parse errors included, so we
  // don't reparse unchanged bad sources).
  const sourceCache = new Map<string, string>()

  function syncMeta() {
    const next: DeckMeta = {}
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
    const sources = readTemplateSources(ydoc)
    const resolved = resolveTemplates(
      { theme: baseTemplates, document: sources },
      compiler.compileCached,
    )
    $templates.set(resolved.templates)
    $docTemplateErrors.set(resolved.errors)
    $docTemplateNames.set(Object.keys(sources).sort())
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

  function canEditPage(id: string): boolean {
    // The read layer already exposes parse errors. Keep displaying its cached
    // content, but never serialize that cache over an unfinished source edit.
    return pages.has(id) && !$pageErrors.get()[id]
  }

  const backend: Backend = {
    updatePage(id, patch) {
      if (canEditPage(id)) commands.patchSlide(ydoc, id, patch)
    },

    setPage(id, next) {
      if (canEditPage(id)) commands.updateSlide(ydoc, id, serializePage(next))
    },

    addPage(page, index) {
      undoManager.stopCapturing()
      const { pageId } = commands.createSlide(ydoc, serializePage(page), { atIndex: index })
      $currentPageId.set(pageId)
    },

    removePage(id) {
      undoManager.stopCapturing()
      if (pages.has(id)) commands.deleteSlide(ydoc, id)
    },

    movePage(from, to) {
      undoManager.stopCapturing()
      const id = $pageIds.get()[from]
      if (id !== undefined) commands.moveSlide(ydoc, id, to)
    },

    setTitle(title) {
      commands.setDeckTitle(ydoc, title)
    },

    switchTemplate(id, newTemplate, patch) {
      undoManager.stopCapturing()
      backend.updatePage(id, { ...patch, template: newTemplate })
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
      if (!templates.has(name)) commands.createDocTemplate(ydoc, name, source)
    },

    setTemplateSource(name, source) {
      undoManager.stopCapturing()
      if (templates.has(name)) commands.updateDocTemplate(ydoc, name, source)
    },

    removeTemplate(name) {
      undoManager.stopCapturing()
      if (templates.has(name)) commands.deleteDocTemplate(ydoc, name)
    },

    dispose() {
      if (scratchTimer) clearTimeout(scratchTimer)
      setUndoManager(null)
      undoManager.destroy()
      meta.unobserve(onMeta)
      order.unobserve(onOrder)
      pages.unobserveDeep(onPages)
      templates.unobserveDeep(onTemplates)
    },
  }
}
