import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { parsePage, serializePage } from '../content/markdown'
import {
  applyTextDiff,
  deckToYUpdate,
  ensureFilenames,
  getPagesMap,
  isDocEmpty,
  readDeck,
  seedDoc,
} from './doc'

const deck = {
  title: 'Test deck',
  config: { page_numbers: true },
  pages: [
    { template: 'Cover', title: 'Hello', subtitle: 'World' },
    { template: 'Basic', title: 'One', text: 'Some *markdown* body\n\nwith paragraphs' },
    {
      template: 'HalfPage',
      title: 'Two',
      body: '::: fenced looking content',
      notes: 'speaker notes',
    },
  ],
}
const filenames = ['cover.md', 'one.md', 'two.md']

describe('seedDoc / readDeck', () => {
  it('round-trips files → doc → files identically', () => {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, deckToYUpdate(deck, filenames))

    const result = readDeck(ydoc)
    expect(result.content).toEqual(deck)
    expect(result.filenames).toEqual(filenames)
    expect(result.pageIds).toHaveLength(3)
  })

  it('page sources are exactly serializePage output', () => {
    const ydoc = new Y.Doc()
    seedDoc(ydoc, deck, filenames)
    const { pageIds } = readDeck(ydoc)
    const pages = getPagesMap(ydoc)
    pageIds.forEach((id, i) => {
      const source = (pages.get(id)!.get('source') as Y.Text).toString()
      expect(source).toEqual(serializePage(deck.pages[i]))
      expect(parsePage(source)).toEqual(deck.pages[i])
    })
  })

  it('re-seeding replaces the deck wholesale', () => {
    const ydoc = new Y.Doc()
    seedDoc(ydoc, deck, filenames)
    const smaller = { pages: [{ template: 'Basic', title: 'Only' }] }
    seedDoc(ydoc, smaller, ['only.md'])
    const result = readDeck(ydoc)
    expect(result.content).toEqual(smaller)
    expect(result.filenames).toEqual(['only.md'])
  })

  it('isDocEmpty reflects seeding', () => {
    const ydoc = new Y.Doc()
    expect(isDocEmpty(ydoc)).toBe(true)
    seedDoc(ydoc, deck, filenames)
    expect(isDocEmpty(ydoc)).toBe(false)
  })
})

describe('applyTextDiff', () => {
  const cases: Array<[string, string]> = [
    ['', 'hello'],
    ['hello', ''],
    ['hello world', 'hello brave world'],
    ['abcdef', 'abXdef'],
    ['line1\nline2\nline3', 'line1\nline2 changed\nline3\nline4'],
    ['aaaa', 'aaa'],
    ['---\ntemplate: Basic\n---\n', '---\ntemplate: Cover\ntitle: X\n---\n\nbody\n'],
  ]

  it('produces the target string', () => {
    for (const [prev, next] of cases) {
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('t')
      ytext.insert(0, prev)
      applyTextDiff(ytext, prev, next)
      expect(ytext.toString()).toEqual(next)
    }
  })

  it('concurrent edits to different regions both survive', () => {
    const base = '---\ntemplate: Basic\ntitle: Hello\n---\n\nsome body text\n'

    const docA = new Y.Doc()
    const a = docA.getText('t')
    a.insert(0, base)
    const docB = new Y.Doc()
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    const b = docB.getText('t')

    // A edits the title, B edits the body — divergent, then merge.
    applyTextDiff(a, base, base.replace('title: Hello', 'title: Goodbye'))
    applyTextDiff(b, base, base.replace('some body text', 'entirely new body'))
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    expect(a.toString()).toEqual(b.toString())
    expect(a.toString()).toContain('title: Goodbye')
    expect(a.toString()).toContain('entirely new body')
  })
})

describe('parsePage', () => {
  it('treats a bare frontmatter key as an empty string, not a missing field', () => {
    const page = parsePage('---\ntemplate: Basic\ntitle:\n---\n')
    expect(page.title).toBe('')
    // Round-trips: the key stays present in the serialized source
    expect(parsePage(serializePage(page))).toEqual(page)
  })
})

describe('ensureFilenames', () => {
  it('fills gaps and dedupes', () => {
    expect(ensureFilenames(['a.md', '', 'a.md', 'b.md'])).toEqual([
      'a.md',
      'untitled.md',
      'a-2.md',
      'b.md',
    ])
  })
})
