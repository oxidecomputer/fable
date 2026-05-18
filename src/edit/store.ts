import { atom, computed, transact } from '@tldraw/state'
import { z } from 'zod'

import type { TemplateMap } from '../Page'
import { commit, restoreHistory } from './history'

export type PageData = Record<string, any> & { template: string }
export type Content = {
  title?: string
  config?: { page_numbers?: boolean }
  pages: PageData[]
}

export const $deck = atom<Content>('deck', { pages: [] })
export const $mode = atom<'edit' | 'present'>('mode', 'edit')
export const $filenames = atom<string[]>('filenames', [])
export const $currentIndex = atom<number>('currentIndex', 0)
export const $saveStatus = atom<'idle' | 'saving' | 'saved' | 'error'>('saveStatus', 'idle')
export const $templates = atom<TemplateMap>('templates', {})
export const $dragIndex = atom<number | null>('dragIndex', null)
export const $overIndex = atom<number | null>('overIndex', null)

export const $currentPage = computed('currentPage', () => {
  const { pages } = $deck.get()
  const i = $currentIndex.get()
  return pages[i]
})

export const $title = computed('title', () => $deck.get().title ?? '')

let initialized = false

export function initializeStore(
  content: Content,
  filenames: string[],
  templates: TemplateMap,
) {
  if (initialized) return
  transact(() => {
    $deck.set(content)
    $filenames.set(filenames)
    $templates.set(templates)
  })
  initialized = true
  restoreHistory()
  applyPageFromUrl()
}

function applyPageFromUrl(): void {
  if (typeof window === 'undefined') return
  const param = new URL(window.location.href).searchParams.get('page')
  if (!param) return
  const n = parseInt(param, 10)
  if (Number.isNaN(n) || n < 1) return
  const target = n - 1
  if (target < $deck.get().pages.length) $currentIndex.set(target)
}

export function unwrapEffects(schema: z.ZodTypeAny | undefined): z.ZodTypeAny | undefined {
  if (!schema) return undefined
  let s: any = schema
  while (s?._def?.typeName === 'ZodEffects') s = s._def.schema
  return s
}

export function updatePage(index: number, patch: Partial<PageData>) {
  const keys = Object.keys(patch).join(',')
  commit(`update-page:${index}:${keys}`, () => {
    $deck.update((d) => {
      const pages = d.pages.slice()
      const current = pages[index]
      if (!current) return d
      const merged = { ...current, ...patch }
      for (const k of Object.keys(merged)) {
        if (merged[k] === '' && k !== 'template') delete merged[k]
      }
      pages[index] = merged
      return { ...d, pages }
    })
  })
}

export function setPage(index: number, next: PageData) {
  commit(`set-page:${index}`, () => {
    $deck.update((d) => {
      const pages = d.pages.slice()
      if (!pages[index]) return d
      pages[index] = next
      return { ...d, pages }
    })
  })
}

export function addPage(templateName: string) {
  commit(null, () => {
    transact(() => {
      const filenames = $filenames.get()
      const nextName = nextPageFilename(filenames)
      $filenames.set([...filenames, nextName])
      $deck.update((d) => ({
        ...d,
        pages: [...d.pages, { template: templateName }],
      }))
      $currentIndex.set($deck.get().pages.length - 1)
    })
  })
}

export function removePage(index: number) {
  commit(null, () => {
    transact(() => {
      const filenames = $filenames.get().slice()
      const pages = $deck.get().pages.slice()
      if (!filenames[index]) return
      filenames.splice(index, 1)
      pages.splice(index, 1)
      $filenames.set(filenames)
      $deck.update((d) => ({ ...d, pages }))
      const len = pages.length
      const cur = $currentIndex.get()
      if (cur >= len) $currentIndex.set(Math.max(0, len - 1))
    })
  })
}

export function movePage(from: number, to: number) {
  if (from === to) return
  commit(null, () => {
    transact(() => {
      const filenames = $filenames.get().slice()
      const pages = $deck.get().pages.slice()
      if (from < 0 || from >= pages.length || to < 0 || to >= pages.length) return
      const [fn] = filenames.splice(from, 1)
      filenames.splice(to, 0, fn)
      const [pg] = pages.splice(from, 1)
      pages.splice(to, 0, pg)
      $filenames.set(filenames)
      $deck.update((d) => ({ ...d, pages }))
      const cur = $currentIndex.get()
      if (cur === from) $currentIndex.set(to)
      else if (from < cur && to >= cur) $currentIndex.set(cur - 1)
      else if (from > cur && to <= cur) $currentIndex.set(cur + 1)
    })
  })
}

export function setTitle(title: string) {
  commit('set-title', () => {
    $deck.update((d) => ({ ...d, title: title || undefined }))
  })
}

export function switchTemplate(index: number, newTemplate: string) {
  commit(null, () => {
    $deck.update((d) => {
      const pages = d.pages.slice()
      const current = pages[index]
      if (!current) return d
      pages[index] = { ...current, template: newTemplate }
      return { ...d, pages }
    })
  })
}

export function nextPageFilename(existing: string[]): string {
  const used = new Set(existing)
  if (!used.has('untitled.md')) return 'untitled.md'
  let n = 2
  while (used.has(`untitled-${n}.md`)) n += 1
  return `untitled-${n}.md`
}
