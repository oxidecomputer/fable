// @vitest-environment jsdom
import { type Root, createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { z } from 'zod'

import { seedDoc } from '../collab/doc'
import oxcon26Theme from '../themes/oxcon26'
import EditShell from './EditShell'
import { type CollabBridge, connectBridge } from './collab/bridge'
import { $collabBridge } from './collab/room'
import { $currentPageId, $pageIds, $pagesById, noopBackend, setBackend } from './store'

// The editor only renders inside a Liveblocks room; mock the room-dependent
// hooks/components so the shell can mount against a local Y.Doc bridge.
vi.mock('@liveblocks/react', () => ({
  useOthers: (selector?: (others: any[]) => any) => (selector ? selector([]) : []),
  useSelf: () => null,
}))

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const deck = {
  title: 'Shell test',
  pages: [
    { template: 'Text', text: 'body one' },
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
  // Extra template with a native variant enum, for the variant dropdown tests
  const Varianted = {
    Schema: z.object({ variant: z.enum(['light', 'dark']).optional() }),
    Template: ({ data }: { data: any }) => <div>{data.variant}</div>,
  }
  // Extra template with a required field, for the placeholder-injection test
  const Linked = {
    Schema: z.object({ url: z.string() }),
    Template: ({ data }: { data: any }) => <div>{data.url}</div>,
  }
  bridge = connectBridge(
    ydoc,
    { ...oxcon26Theme.templates, Varianted, Linked },
    null,
    undefined,
    oxcon26Theme.templateExports,
  )
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
  it('renders page rows, tabs, and the template selector', () => {
    expect(container.querySelectorAll('[data-page-row]')).toHaveLength(2)
    for (const label of ['Source', 'Template']) {
      expect(container.textContent).toContain(label)
    }
    // Template select shows the current template
    const select = container.querySelector('select')!
    expect(select.value).toBe('Text')
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
    expect(cm!.textContent).toContain('template: Text')
  })

  it('templates tab shows the current template read-only, and forks it', async () => {
    clickText('Template')
    await act(async () => {})
    // Current slide uses Text (a theme template) — shown read-only with source
    expect(container.textContent).toContain('Text')
    expect(container.textContent).toContain('read-only')
    expect(container.querySelector('.cm-content')?.textContent).toContain('Schema')

    // Fork: creates a doc template from Text's source (its @oxide/fable
    // imports compile via the theme's templateExports) and points the slide at it
    clickText('Edit a copy')
    await act(async () => {})
    expect(ydoc.getMap('templates').has('Custom')).toBe(true)
    expect($pagesById.get()[$currentPageId.get()!].template).toBe('Custom')
    expect(container.textContent).toContain('live for everyone')
    // No compile error — the forked built-in source compiled
    expect(container.textContent).not.toContain('not available in doc templates')

    // The template selector (above the tabs) now shows the fork
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('Custom')
  })

  it('switching templates injects placeholders for missing required fields', () => {
    const select = container.querySelector('select') as HTMLSelectElement
    act(() => {
      select.value = 'Linked'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const id = $currentPageId.get()!
    const page = $pagesById.get()[id]
    expect(page.template).toBe('Linked')
    // Linked requires `url`; the switch wrote a placeholder into the source
    expect(page.url).toBe('Url')
    expect(bridge.getPageText(id)!.toString()).toContain('url: Url')
  })

  it('switching templates drops untouched placeholders but keeps edited content', () => {
    const select = container.querySelector('select') as HTMLSelectElement
    act(() => {
      select.value = 'Linked'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const id = $currentPageId.get()!
    // `text` is authored content Linked doesn't know — kept, not dropped
    expect($pagesById.get()[id].text).toBe('body one')
    expect($pagesById.get()[id].url).toBe('Url')

    act(() => {
      select.value = 'Text'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // The untouched `url` placeholder isn't part of Text — dropped on switch
    expect($pagesById.get()[id].url).toBeUndefined()
    expect(bridge.getPageText(id)!.toString()).not.toContain('url')
    expect($pagesById.get()[id].text).toBe('body one')
  })

  it('shows a soft unused-fields notice with one-click removal', () => {
    const select = container.querySelector('select') as HTMLSelectElement
    act(() => {
      select.value = 'Linked'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // `text` survived the switch (edited content) and Linked doesn't use it
    expect(container.textContent).toContain('Unused field')
    expect(container.textContent).toContain('text')
    // ...but it isn't presented as a schema error over the stage
    expect(container.textContent).not.toContain('schema issue')

    clickText('Remove')
    const id = $currentPageId.get()!
    expect($pagesById.get()[id].text).toBeUndefined()
    expect(container.textContent).not.toContain('Unused field')
  })

  it('shows a variant dropdown only for templates with a variant enum', () => {
    // Text has no variant field — just the template select
    expect(container.querySelectorAll('select')).toHaveLength(1)

    const select = container.querySelector('select') as HTMLSelectElement
    act(() => {
      select.value = 'Varianted'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const selects = container.querySelectorAll('select')
    expect(selects).toHaveLength(2)
    const variant = selects[1] as HTMLSelectElement
    // Optional enum gets a Default choice (clears the key) plus the options
    expect([...variant.options].map((o) => o.value)).toEqual(['', 'light', 'dark'])

    act(() => {
      variant.value = 'dark'
      variant.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const id = $currentPageId.get()!
    expect($pagesById.get()[id].variant).toBe('dark')
    expect(bridge.getPageText(id)!.toString()).toContain('variant: dark')
  })

  it('disables template switching when a page source is broken', () => {
    const id = $currentPageId.get()!
    const ytext = bridge.getPageText(id)!
    act(() => {
      ydoc.transact(() => ytext.delete(0, 4))
    })
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.disabled).toBe(true)
  })
})
