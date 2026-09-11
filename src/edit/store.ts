import { atom, computed } from '@tldraw/state'
import { z } from 'zod'

import type { TemplateMap } from '../Page'
import { nextPageFilename } from '../collab/ops'

export { nextPageFilename }

export type PageData = Record<string, any> & { template: string }
export type DeckMeta = {
  title?: string
  config?: { page_numbers?: boolean }
}
export type Content = DeckMeta & { pages: PageData[] }

// Core state, keyed by stable page ids (nanoid, minted when a page enters
// the Yjs doc). The room bridge populates these; they are a derived read
// layer over the doc, never mutated directly by components.
export const $meta = atom<DeckMeta>('meta', {})
export const $pageIds = atom<string[]>('pageIds', [])
export const $pagesById = atom<Record<string, PageData>>('pagesById', {})
export const $filenamesById = atom<Record<string, string>>('filenamesById', {})
export const $currentPageId = atom<string | null>('currentPageId', null)
/** Per-page parse errors (a remote user's source may be transiently unparseable). */
export const $pageErrors = atom<Record<string, string>>('pageErrors', {})

export const $mode = atom<'edit' | 'present'>('mode', 'edit')

// Right sidebar (inspector) width — user-resizable, min is the design width.
export const INSPECTOR_MIN_WIDTH = 340
export const INSPECTOR_MAX_WIDTH = 800
const INSPECTOR_WIDTH_KEY = 'fable:inspector-width'

function clampInspectorWidth(w: number): number {
  return Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, Math.round(w)))
}

function loadInspectorWidth(): number {
  if (typeof localStorage === 'undefined') return INSPECTOR_MIN_WIDTH
  try {
    const raw = localStorage.getItem(INSPECTOR_WIDTH_KEY)
    const n = raw === null ? NaN : parseInt(raw, 10)
    return Number.isNaN(n) ? INSPECTOR_MIN_WIDTH : clampInspectorWidth(n)
  } catch {
    return INSPECTOR_MIN_WIDTH
  }
}

export const $inspectorWidth = atom<number>('inspectorWidth', loadInspectorWidth())

export function setInspectorWidth(width: number) {
  const next = clampInspectorWidth(width)
  $inspectorWidth.set(next)
  try {
    localStorage.setItem(INSPECTOR_WIDTH_KEY, String(next))
  } catch {
    /* ignore */
  }
}
export const $templates = atom<TemplateMap>('templates', {})
export const $dragIndex = atom<number | null>('dragIndex', null)
export const $overIndex = atom<number | null>('overIndex', null)

export const $deck = computed<Content>('deck', () => {
  const byId = $pagesById.get()
  const pages = $pageIds
    .get()
    .map((id) => byId[id])
    .filter((p): p is PageData => p !== undefined)
  return { ...$meta.get(), pages }
})

export const $filenames = computed<string[]>('filenames', () => {
  const byId = $filenamesById.get()
  return $pageIds.get().map((id) => byId[id] ?? '')
})

export const $currentIndex = computed<number>('currentIndex', () => {
  const id = $currentPageId.get()
  if (id === null) return 0
  const i = $pageIds.get().indexOf(id)
  return i === -1 ? 0 : i
})

export const $currentPage = computed('currentPage', () => {
  const id = $currentPageId.get()
  if (id === null) return undefined
  return $pagesById.get()[id]
})

export const $title = computed('title', () => $meta.get().title ?? '')

export function setCurrentIndex(index: number) {
  const ids = $pageIds.get()
  const id = ids[index]
  if (id !== undefined) $currentPageId.set(id)
}

export function pageIdAt(index: number): string | undefined {
  return $pageIds.get()[index]
}

export function applyPageFromUrl(): void {
  if (typeof window === 'undefined') return
  const param = new URL(window.location.href).searchParams.get('page')
  if (!param) return
  const n = parseInt(param, 10)
  if (Number.isNaN(n) || n < 1) return
  setCurrentIndex(n - 1)
}

/**
 * Document mutations, implemented by the room bridge (writes to the Yjs
 * doc; the observer round-trips changes back into the atoms above).
 */
export type Backend = {
  updatePage(id: string, patch: Partial<PageData>): void
  setPage(id: string, next: PageData): void
  addPage(templateName: string): void
  removePage(id: string): void
  movePage(from: number, to: number): void
  setTitle(title: string): void
  switchTemplate(id: string, template: string): void
}

/** Merge a patch into a page, deleting keys set to '' (except template). */
export function mergePatch(current: PageData, patch: Partial<PageData>): PageData {
  const merged: PageData = { ...current, ...patch }
  for (const k of Object.keys(merged)) {
    if (merged[k] === '' && k !== 'template') delete merged[k]
  }
  return merged
}

/** Inert backend used before the room connects. */
export const noopBackend: Backend = {
  updatePage() {},
  setPage() {},
  addPage() {},
  removePage() {},
  movePage() {},
  setTitle() {},
  switchTemplate() {},
}

let backend: Backend = noopBackend

export function setBackend(next: Backend) {
  backend = next
}

// Public mutators — index-based signatures kept for existing components;
// they resolve the stable id and dispatch to the room backend.
export function updatePage(index: number, patch: Partial<PageData>) {
  const id = pageIdAt(index)
  if (id !== undefined) backend.updatePage(id, patch)
}

export function setPage(index: number, next: PageData) {
  const id = pageIdAt(index)
  if (id !== undefined) backend.setPage(id, next)
}

export function addPage(templateName: string) {
  backend.addPage(templateName)
}

export function removePage(index: number) {
  const id = pageIdAt(index)
  if (id !== undefined) backend.removePage(id)
}

export function movePage(from: number, to: number) {
  if (from === to) return
  backend.movePage(from, to)
}

export function setTitle(title: string) {
  backend.setTitle(title)
}

export function switchTemplate(index: number, newTemplate: string) {
  const id = pageIdAt(index)
  if (id !== undefined) backend.switchTemplate(id, newTemplate)
}

export function unwrapEffects(schema: z.ZodTypeAny | undefined): z.ZodTypeAny | undefined {
  if (!schema) return undefined
  let s: any = schema
  while (s?._def?.typeName === 'ZodEffects') s = s._def.schema
  return s
}
