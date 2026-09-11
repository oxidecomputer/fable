// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { readDeck, seedDoc } from '../../collab/doc'
import {
  $currentPageId,
  $deck,
  $filenames,
  $pageErrors,
  $pageIds,
  $pagesById,
  $title,
  noopBackend,
  setBackend,
} from '../store'
import { type CollabBridge, connectBridge } from './bridge'

const deck = {
  title: 'Bridge test',
  pages: [
    { template: 'Basic', title: 'One', text: 'first body' },
    { template: 'Cover', title: 'Two' },
  ],
}
const filenames = ['one.md', 'two.md']

function setup(): { ydoc: Y.Doc; bridge: CollabBridge } {
  const ydoc = new Y.Doc()
  seedDoc(ydoc, deck, filenames)
  const bridge = connectBridge(ydoc, {}, null)
  setBackend(bridge.backend)
  return { ydoc, bridge }
}

let current: { ydoc: Y.Doc; bridge: CollabBridge }

beforeEach(() => {
  current?.bridge.dispose()
  current = setup()
})

describe('bridge read path', () => {
  it('populates atoms from the doc', () => {
    expect($deck.get().pages).toEqual(deck.pages)
    expect($title.get()).toBe('Bridge test')
    expect($filenames.get()).toEqual(filenames)
    expect($pageIds.get()).toHaveLength(2)
  })

  it('remote edits flow into atoms', () => {
    const { ydoc, bridge } = current
    // Simulate a remote client syncing an edit in.
    const remote = new Y.Doc()
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc))
    const id = $pageIds.get()[0]
    const rtext = remote.getMap<Y.Map<any>>('pages').get(id)!.get('source') as Y.Text
    rtext.insert(rtext.length, 'appended remotely\n')
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(ydoc)))

    expect($pagesById.get()[id].text).toContain('appended remotely')
    expect(bridge.undoManager.canUndo()).toBe(false) // remote edits are not undoable
  })

  it('keeps last-good parse and flags error on unparseable remote source', () => {
    const { ydoc } = current
    const id = $pageIds.get()[0]
    const ytext = ydoc.getMap<Y.Map<any>>('pages').get(id)!.get('source') as Y.Text
    ydoc.transact(() => ytext.delete(0, 4)) // breaks the frontmatter fence

    expect($pageErrors.get()[id]).toBeTruthy()
    expect($pagesById.get()[id]).toEqual(deck.pages[0]) // last good
  })
})

describe('bridge write path (backend)', () => {
  it('updatePage round-trips through the doc', () => {
    const { ydoc, bridge } = current
    const id = $pageIds.get()[0]
    bridge.backend.updatePage(id, { title: 'Renamed' })
    expect($pagesById.get()[id].title).toBe('Renamed')
    expect(readDeck(ydoc).content.pages[0].title).toBe('Renamed')
  })

  it("updatePage with '' deletes the key", () => {
    const { bridge } = current
    const id = $pageIds.get()[0]
    bridge.backend.updatePage(id, { text: '' })
    expect($pagesById.get()[id].text).toBeUndefined()
  })

  it('addPage / removePage / movePage', () => {
    const { bridge } = current
    bridge.backend.addPage('Basic')
    expect($pageIds.get()).toHaveLength(3)
    expect($filenames.get()[2]).toBe('untitled.md')
    expect($currentPageId.get()).toBe($pageIds.get()[2])

    bridge.backend.movePage(2, 0)
    expect($deck.get().pages[0]).toEqual({ template: 'Basic' })

    bridge.backend.removePage($pageIds.get()[0])
    expect($pageIds.get()).toHaveLength(2)
    expect($deck.get().pages.map((p) => p.title)).toEqual(['One', 'Two'])
  })

  it('setTitle updates meta', () => {
    const { ydoc, bridge } = current
    bridge.backend.setTitle('New title')
    expect($title.get()).toBe('New title')
    expect(readDeck(ydoc).content.title).toBe('New title')
    bridge.backend.setTitle('')
    expect($title.get()).toBe('')
  })

  it('local edits are undoable via the shared UndoManager', () => {
    const { bridge } = current
    const id = $pageIds.get()[0]
    bridge.backend.updatePage(id, { title: 'Changed' })
    expect(bridge.undoManager.canUndo()).toBe(true)
    bridge.undoManager.undo()
    expect($pagesById.get()[id].title).toBe('One')
    bridge.undoManager.redo()
    expect($pagesById.get()[id].title).toBe('Changed')
  })

  it('two bridged docs converge on concurrent edits to different pages', () => {
    const { ydoc, bridge } = current
    const other = new Y.Doc()
    Y.applyUpdate(other, Y.encodeStateAsUpdate(ydoc))
    const [id1, id2] = $pageIds.get()

    bridge.backend.updatePage(id1, { title: 'From A' })
    const otherText = other.getMap<Y.Map<any>>('pages').get(id2)!.get('source') as Y.Text
    otherText.insert(otherText.length, 'B body\n')

    Y.applyUpdate(other, Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(other)))
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(ydoc)))

    const result = readDeck(ydoc)
    expect(result.content.pages[0].title).toBe('From A')
    expect(result.content.pages[1].text).toContain('B body')
    expect(readDeck(other).content).toEqual(result.content)
  })
})

// Reset the backend for any later suites.
it('cleanup', () => {
  current.bridge.dispose()
  setBackend(noopBackend)
})
