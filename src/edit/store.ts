import { atom, computed } from '@tldraw/state'

import { parsePage, serializePage } from '../content/markdown'
import { missingFieldPlaceholders, stalePlaceholderFields } from '../content/placeholders'
import type { DeckContent, DeckMeta, PageData, TemplateMap } from '../model'

export { mergePatch, nextPageFilename } from '../collab/ops'
export { unwrapEffects } from '../templates/validation'
export type { DeckContent as Content, DeckMeta, PageData } from '../model'

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

// Edit-only view settings (stage overlays etc.) — local to this client,
// persisted across sessions. Present/preview surfaces never read these.
export type ViewSettings = {
  /** Show the theme's grid overlay on the edit stage (toggled with "g"). */
  grid: boolean
}

const VIEW_SETTINGS_KEY = 'fable:view-settings'
const defaultViewSettings: ViewSettings = { grid: false }

function loadViewSettings(): ViewSettings {
  if (typeof localStorage === 'undefined') return defaultViewSettings
  try {
    const raw = localStorage.getItem(VIEW_SETTINGS_KEY)
    return raw ? { ...defaultViewSettings, ...JSON.parse(raw) } : defaultViewSettings
  } catch {
    return defaultViewSettings
  }
}

export const $viewSettings = atom<ViewSettings>('viewSettings', loadViewSettings())

export function toggleViewSetting(key: keyof ViewSettings) {
  const next = { ...$viewSettings.get(), [key]: !$viewSettings.get()[key] }
  $viewSettings.set(next)
  try {
    localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

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

export const $deck = computed<DeckContent>('deck', () => {
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
  addPage(page: PageData, index?: number): void
  removePage(id: string): void
  movePage(from: number, to: number): void
  setTitle(title: string): void
  switchTemplate(id: string, template: string, patch?: Partial<PageData>): void
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
  // Populate required fields with placeholders so the new slide renders
  // immediately instead of showing schema errors, and insert it right after
  // the slide the user is on.
  const schema = $templates.get()[templateName]?.Schema
  const page: PageData = {
    template: templateName,
    ...missingFieldPlaceholders(schema, {}),
  }
  backend.addPage(page, $currentIndex.get() + 1)
}

// In-app clipboard for page copy/paste in the sidebar. Stored as serialized
// page source so a paste is a full, independent copy.
let copiedPageSource: string | null = null

export function copyPage(index: number) {
  const id = pageIdAt(index)
  const page = id === undefined ? undefined : $pagesById.get()[id]
  if (!page) return
  copiedPageSource = serializePage(page)
  // Best-effort mirror to the system clipboard (readable as markdown).
  if (typeof navigator !== 'undefined') {
    navigator.clipboard?.writeText(copiedPageSource).catch(() => {})
  }
}

/** Paste the copied page directly after `index`. No-op if nothing was copied. */
export function pastePage(index: number) {
  if (copiedPageSource === null) return
  try {
    backend.addPage(parsePage(copiedPageSource), index + 1)
  } catch {
    /* stale/unparseable clipboard — ignore */
  }
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
  if (id === undefined) return
  // Populate the source with placeholders for the new template's required
  // fields, so the switched slide renders and the fields are visible to edit.
  // Leftover fields the new template doesn't use are dropped when their value
  // is still the old template's untouched placeholder; edited content stays
  // (surfacing as an "unused fields" notice instead).
  const page = $pagesById.get()[id] ?? { template: newTemplate }
  const oldSchema = $templates.get()[page.template]?.Schema
  const schema = $templates.get()[newTemplate]?.Schema
  const patch: Partial<PageData> = {
    ...missingFieldPlaceholders(schema, page),
    // '' deletes the key in mergePatch
    ...Object.fromEntries(
      stalePlaceholderFields(oldSchema, schema, page).map((k) => [k, '']),
    ),
  }
  backend.switchTemplate(id, newTemplate, patch)
}
