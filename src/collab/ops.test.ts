import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { readDeck, seedDoc } from './doc'
import * as ops from './ops'

const deck = {
  title: 'Ops test',
  pages: [
    { template: 'Basic', title: 'First', text: 'body one' },
    { template: 'Cover', title: 'Second' },
  ],
}

let ydoc: Y.Doc

beforeEach(() => {
  ydoc = new Y.Doc()
  seedDoc(ydoc, deck, ['first.md', 'second.md'])
})

describe('slide ops', () => {
  it('listSlides returns the outline with titles and parse status', () => {
    const { title, slides } = ops.listSlides(ydoc)
    expect(title).toBe('Ops test')
    expect(slides.map((s) => [s.index, s.template, s.title, s.parseError])).toEqual([
      [0, 'Basic', 'First', null],
      [1, 'Cover', 'Second', null],
    ])
    expect(slides[0].filename).toBe('first.md')
  })

  it('read/update round-trips through the doc', () => {
    const { slides } = ops.listSlides(ydoc)
    const source = ops.readSlide(ydoc, slides[0].pageId)
    expect(source).toContain('template: Basic')

    const next = source.replace('First', 'Renamed')
    ops.updateSlide(ydoc, slides[0].pageId, next)
    expect(readDeck(ydoc).content.pages[0].title).toBe('Renamed')
  })

  it('updateSlide rejects unparseable source with an OpError', () => {
    const { slides } = ops.listSlides(ydoc)
    expect(() => ops.updateSlide(ydoc, slides[0].pageId, 'no frontmatter')).toThrow(
      ops.OpError,
    )
    expect(() => ops.readSlide(ydoc, 'missing-id')).toThrow(/list_slides/)
  })

  it('patches current fields and preserves unrelated changes', () => {
    const id = ops.listSlides(ydoc).slides[0].pageId
    ops.patchSlide(ydoc, id, { text: 'Another collaborator changed this' })
    ops.patchSlide(ydoc, id, { title: 'Renamed' })
    expect(readDeck(ydoc).content.pages[0]).toEqual({
      template: 'Basic',
      title: 'Renamed',
      text: 'Another collaborator changed this',
    })
    ops.patchSlide(ydoc, id, { text: '' })
    expect(readDeck(ydoc).content.pages[0].text).toBeUndefined()
  })

  it('refuses to patch unfinished source without changing it', () => {
    const id = ops.listSlides(ydoc).slides[0].pageId
    const source = ydoc.getMap<Y.Map<any>>('pages').get(id)!.get('source') as Y.Text
    source.delete(0, 4)
    const draft = source.toString()
    expect(() => ops.patchSlide(ydoc, id, { title: 'Renamed' })).toThrow(ops.OpError)
    expect(source.toString()).toBe(draft)
  })

  it('createSlide appends or inserts, deriving filenames from titles', () => {
    const created = ops.createSlide(ydoc, '---\ntemplate: Basic\ntitle: New Slide!\n---\n')
    expect(created.filename).toBe('new-slide.md')
    expect(ops.listSlides(ydoc).slides[2].pageId).toBe(created.pageId)

    const inserted = ops.createSlide(
      ydoc,
      '---\ntemplate: Cover\ntitle: New Slide\n---\n',
      {
        atIndex: 1,
      },
    )
    expect(inserted.filename).toBe('new-slide-2.md') // slug collision deduped
    expect(ops.listSlides(ydoc).slides[1].pageId).toBe(inserted.pageId)

    const explicit = ops.createSlide(ydoc, '---\ntemplate: Cover\n---\n', {
      filename: 'closing.md',
    })
    expect(explicit.filename).toBe('closing.md')

    const untitled = ops.createSlide(ydoc, '---\ntemplate: Cover\n---\n')
    expect(untitled.filename).toBe('untitled.md')
  })

  it('delete and move', () => {
    const [a, b] = ops.listSlides(ydoc).slides.map((s) => s.pageId)
    ops.moveSlide(ydoc, b, 0)
    expect(ops.listSlides(ydoc).slides.map((s) => s.pageId)).toEqual([b, a])
    ops.deleteSlide(ydoc, b)
    expect(ops.listSlides(ydoc).slides.map((s) => s.pageId)).toEqual([a])
    expect(() => ops.deleteSlide(ydoc, b)).toThrow(ops.OpError)
  })

  it('setDeckTitle sets and clears', () => {
    ops.setDeckTitle(ydoc, 'New title')
    expect(ops.listSlides(ydoc).title).toBe('New title')
    ops.setDeckTitle(ydoc, '')
    expect(ops.listSlides(ydoc).title).toBe(null)
  })
})

describe('template ops', () => {
  const GOOD = `import { z } from 'zod'
export const Schema = z.object({ title: z.string() })
export function Template({ data }) { return <h1>{data.title}</h1> }
`

  it('create/read/update/delete a doc template', () => {
    ops.createDocTemplate(ydoc, 'Mine', GOOD)
    expect(ops.listDocTemplates(ydoc)).toEqual(['Mine'])
    expect(ops.readDocTemplate(ydoc, 'Mine')).toBe(GOOD)
    expect(() => ops.createDocTemplate(ydoc, 'Mine', GOOD)).toThrow(/already exists/)

    const v2 = GOOD.replace('h1', 'h2')
    ops.updateDocTemplate(ydoc, 'Mine', v2)
    expect(ops.readDocTemplate(ydoc, 'Mine')).toBe(v2)

    ops.deleteDocTemplate(ydoc, 'Mine')
    expect(ops.listDocTemplates(ydoc)).toEqual([])
  })

  it('stores unfinished drafts without evaluating template code', () => {
    ops.createDocTemplate(ydoc, 'Draft', 'export const {')
    expect(ops.readDocTemplate(ydoc, 'Draft')).toBe('export const {')
    const browserSource = 'window.templateLoaded = true; export function Template() {}'
    ops.updateDocTemplate(ydoc, 'Draft', browserSource)
    expect(ops.readDocTemplate(ydoc, 'Draft')).toBe(browserSource)
  })

  it('updateDocTemplate refuses built-ins by name', () => {
    expect(() => ops.updateDocTemplate(ydoc, 'Basic', GOOD)).toThrow(/read-only/)
  })
})
