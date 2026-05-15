import { useValue } from '@tldraw/state-react'
import { type ReactNode, useState } from 'react'

import PageList from './PageList'
import RawEditor from './RawEditor'
import SchemaForm from './SchemaForm'
import {
  $currentIndex,
  $currentPage,
  $saveStatus,
  $templates,
  switchTemplate,
  updatePage,
} from './store'
import { useSchemaErrors } from './useSchemaErrors'

type Props = { children: ReactNode }

const STATUS_LABEL: Record<string, string> = {
  idle: 'Editing',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Save failed',
}

const STATUS_COLOR: Record<string, string> = {
  idle: 'text-quaternary',
  saving: 'text-accent-secondary',
  saved: 'text-accent',
  error: 'text-destructive',
}

const BRAND = ['F', 'A', 'B', 'L', 'E']

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

export default function EditShell({ children }: Props) {
  const page = useValue($currentPage)
  const templates = useValue($templates)
  const status = useValue($saveStatus)
  const index = useValue($currentIndex)
  const [tab, setTab] = useState<'content' | 'source'>('content')

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

      <aside className="w-[340px] shrink-0 flex flex-col border-l border-default bg-raise text-default">
        <header className="shrink-0 flex items-center justify-between border-b border-default bg-raise pr-3">
          <div className="flex">
            <TabButton active={tab === 'content'} onClick={() => setTab('content')}>
              Content
            </TabButton>
            <TabButton active={tab === 'source'} onClick={() => setTab('source')}>
              Source
            </TabButton>
          </div>
          <span className={`text-mono-xs ${STATUS_COLOR[status] ?? ''}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </header>

        <section className="flex-1 min-h-0 flex flex-col p-3">
          {!page ? (
            <div className="text-mono-xs text-quaternary italic">No page selected</div>
          ) : tab === 'content' ? (
            <>
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
            </>
          ) : (
            <RawEditor />
          )}
        </section>
      </aside>
    </div>
  )
}
