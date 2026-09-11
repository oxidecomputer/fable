import { useValue } from '@tldraw/state-react'
import { type ReactNode, useState } from 'react'

import PageList from './PageList'
import RawEditor from './RawEditor'
import SchemaForm from './SchemaForm'
import Avatars from './collab/Avatars'
import CommentsPanel from './collab/CommentsPanel'
import TemplatesPanel from './collab/TemplatesPanel'
import {
  $currentIndex,
  $currentPage,
  $currentPageId,
  $inspectorWidth,
  $pageErrors,
  $templates,
  setInspectorWidth,
  switchTemplate,
  updatePage,
} from './store'
import { useSchemaErrors } from './useSchemaErrors'

type Props = { children: ReactNode }

type Tab = 'content' | 'source' | 'comments' | 'templates'

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-mono-xs px-3 py-2 border-b -mb-px ${
        active
          ? 'text-default border-accent-secondary'
          : 'text-quaternary border-transparent hover:text-default'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Drag handle on the inspector's left edge. The sidebar is flush with the
 * window's right edge, so its width is just `innerWidth - pointerX`.
 */
function ResizeHandle() {
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const onMove = (ev: PointerEvent) => setInspectorWidth(window.innerWidth - ev.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onPointerDown={startResize}
      className="absolute left-0 top-0 bottom-0 w-1.5 -ml-1 z-20 cursor-col-resize hover:bg-accent-secondary active:bg-accent-secondary"
    />
  )
}

export default function EditShell({ children }: Props) {
  const page = useValue($currentPage)
  const pageId = useValue($currentPageId)
  const templates = useValue($templates)
  const index = useValue($currentIndex)
  const pageErrors = useValue($pageErrors)
  const inspectorWidth = useValue($inspectorWidth)
  const [tab, setTab] = useState<Tab>('content')

  const parseError = pageId ? pageErrors[pageId] : undefined

  const template = page ? templates[page.template] : undefined
  const errors = useSchemaErrors(template, page ?? {})
  const errorKeys = new Set<string>()
  if (errors) for (const e of errors) if (e.path[0]) errorKeys.add(String(e.path[0]))

  return (
    <div className="fable-editor flex h-full">
      <aside className="w-[300px] shrink-0 flex flex-col border-r border-default overflow-hidden bg-raise text-default">
        <div className="flex-1 overflow-y-auto">
          <PageList />
        </div>
      </aside>

      <div className="flex-1 stage relative bg-default">
        {children}
        <div className="absolute top-3 right-3 z-10">
          <Avatars />
        </div>
        {errors && errors.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[80%] rounded border bg-notice text-notice border-notice px-3 py-1.5 text-sans-sm backdrop-blur-sm shadow-lg">
            <div className="font-medium mb-0.5">
              {errors.length} schema {errors.length === 1 ? 'issue' : 'issues'}
            </div>
            <ul className="space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>
                  <code>{e.path.join('.') || '(root)'}</code> — {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside
        style={{ width: inspectorWidth }}
        className="relative shrink-0 flex flex-col border-l border-default bg-raise text-default"
      >
        <ResizeHandle />
        <header className="shrink-0 flex items-center border-b border-default bg-raise">
          <TabButton active={tab === 'content'} onClick={() => setTab('content')}>
            Content
          </TabButton>
          <TabButton active={tab === 'source'} onClick={() => setTab('source')}>
            Source
          </TabButton>
          <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
            Comments
          </TabButton>
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
            Templates
          </TabButton>
        </header>

        <section className="flex-1 min-h-0 flex flex-col p-3">
          {tab === 'source' ? (
            <RawEditor />
          ) : tab === 'comments' ? (
            <CommentsPanel />
          ) : tab === 'templates' ? (
            <TemplatesPanel />
          ) : !page ? (
            <div className="text-mono-xs text-quaternary italic">No page selected</div>
          ) : tab === 'content' ? (
            <>
              {parseError && (
                <div className="shrink-0 mb-3 rounded border border-notice bg-notice text-notice px-2 py-1.5 text-mono-xs">
                  Page source is currently unparseable (someone may be mid-edit) — fields
                  are disabled.
                </div>
              )}
              <div
                className={`flex flex-1 flex-col min-h-0 overflow-y-auto ${
                  parseError ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <label className="block mb-3">
                  <span className="block text-mono-xs text-quaternary mb-1">Template</span>
                  <select
                    value={page.template ?? ''}
                    onChange={(e) => switchTemplate(index, e.target.value)}
                    className="w-full bg-default border border-default rounded text-sans-sm px-2 py-1.5 text-default focus:outline-none focus:border-accent-secondary"
                  >
                    {Object.keys(templates)
                      .sort()
                      .map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    {!templates[page.template] && (
                      <option value={page.template}>{page.template} (missing)</option>
                    )}
                  </select>
                </label>
                <SchemaForm
                  schema={template?.Schema}
                  value={page}
                  errorKeys={errorKeys}
                  onChange={(key, next) => updatePage(index, { [key]: next })}
                />
              </div>
            </>
          ) : null}
        </section>
      </aside>
    </div>
  )
}
