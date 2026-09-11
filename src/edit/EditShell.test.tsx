// @vitest-environment jsdom
import { type Root, createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { seedDoc } from '../collab/doc'
import oxideTheme from '../themes/oxide'
import EditShell from './EditShell'
import { type CollabBridge, connectBridge } from './collab/bridge'
import { $collabBridge } from './collab/room'
import { $currentPageId, $pageIds, $pagesById, noopBackend, setBackend } from './store'

// The editor only renders inside a Liveblocks room; mock the room-dependent
// hooks/components so the shell can mount against a local Y.Doc bridge.
vi.mock('@liveblocks/react', () => ({
  useOthers: (selector?: (others: any[]) => any) => (selector ? selector([]) : []),
  useSelf: () => null,
  useThreads: () => ({ threads: [], error: null, isLoading: false }),
}))
vi.mock('@liveblocks/react-ui', () => ({
  Thread: () => null,
  Composer: () => null,
}))

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const deck = {
  title: 'Shell test',
  pages: [
    { template: 'Basic', title: 'First', text: 'body one' },
    { template: 'Cover', title: 'Second' },
  ],
}

let ydoc: Y.Doc
let bridge: CollabBridge
let root: Root
let container: HTMLElement

function clickText(text: string) {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent === text)
  expect(el, `button "${text}"`).toBeTruthy()
  act(() => el!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

beforeEach(() => {
  // Atoms are module-global — reset navigation state between tests.
  $currentPageId.set(null)
  $pageIds.set([])
  ydoc = new Y.Doc()
  seedDoc(ydoc, deck, ['first.md', 'second.md'])
  bridge = connectBridge(ydoc, oxideTheme.templates, null)
  setBackend(bridge.backend)
  $collabBridge.set(bridge)

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <EditShell>
        <div data-testid="stage" />
      </EditShell>,
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  bridge.dispose()
  $collabBridge.set(null)
  setBackend(noopBackend)
})

describe('EditShell (collab)', () => {
  it('renders page rows, tabs, and the schema form', () => {
    expect(container.querySelectorAll('[data-page-row]')).toHaveLength(2)
    for (const label of ['Content', 'Source', 'Comments', 'Templates']) {
      expect(container.textContent).toContain(label)
    }
    // Template select shows the current template
    const select = container.querySelector('select')!
    expect(select.value).toBe('Basic')
  })

  it('adding a page through the UI writes to the doc', () => {
    clickText('New slide')
    expect($pageIds.get()).toHaveLength(3)
    expect(ydoc.getArray('order').length).toBe(3)
    expect(container.querySelectorAll('[data-page-row]')).toHaveLength(3)
  })

  it('source tab mounts a CodeMirror bound to the page Y.Text', async () => {
    clickText('Source')
    await act(async () => {})
    const cm = container.querySelector('.cm-content')
    expect(cm).toBeTruthy()
    expect(cm!.textContent).toContain('template: Basic')
  })

  it('templates tab shows the current template read-only, and forks it', async () => {
    clickText('Templates')
    await act(async () => {})
    // Current slide uses Basic (a theme template) — shown read-only with source
    expect(container.textContent).toContain('Basic')
    expect(container.textContent).toContain('read-only')
    expect(container.querySelector('.cm-content')?.textContent).toContain('Schema')

    // Fork: creates a doc template from Basic's source (imports compile via
    // the './Util' alias) and points the slide at it
    clickText('Edit a copy')
    await act(async () => {})
    expect(ydoc.getMap('templates').has('Custom')).toBe(true)
    expect($pagesById.get()[$currentPageId.get()!].template).toBe('Custom')
    expect(container.textContent).toContain('live for everyone')
    // No compile error — the forked built-in source compiled
    expect(container.textContent).not.toContain('not available in doc templates')

    // Content tab's selector now shows the fork
    clickText('Content')
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('Custom')
  })

  it('shows the parse-error state when a page source is broken', () => {
    const id = $currentPageId.get()!
    const ytext = bridge.getPageText(id)!
    act(() => {
      ydoc.transact(() => ytext.delete(0, 4))
    })
    expect(container.textContent).toContain('currently unparseable')
  })
})
