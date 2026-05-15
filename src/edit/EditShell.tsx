import { useValue } from '@tldraw/state-react'
import type { ReactNode } from 'react'

import PageList from './PageList'
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
  idle: 'Editing…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

const STATUS_COLOR: Record<string, string> = {
  idle: 'text-neutral-400',
  saving: 'text-indigo-300',
  saved: 'text-emerald-400',
  error: 'text-red-400',
}

export default function EditShell({ children }: Props) {
  const page = useValue($currentPage)
  const templates = useValue($templates)
  const status = useValue($saveStatus)
  const index = useValue($currentIndex)

  const template = page ? templates[page.template] : undefined
  const errors = useSchemaErrors(template, page ?? {})
  const errorKeys = new Set<string>()
  if (errors) for (const e of errors) if (e.path[0]) errorKeys.add(String(e.path[0]))

  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-neutral-700 overflow-y-auto bg-neutral-800 text-neutral-200">
        <header className="px-3 py-2 border-b border-neutral-700 sticky top-0 bg-neutral-800 z-10">
          <span className="text-xs font-semibold tracking-wide">Fable Editor</span>
        </header>
        <PageList />
      </aside>

      <div className="flex-1 relative">
        {children}
        {errors && errors.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[80%] rounded border border-amber-900/50 bg-amber-900/30 px-3 py-1.5 text-xs text-amber-300/90 backdrop-blur-sm shadow-lg">
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

      <aside className="w-[340px] shrink-0 border-l border-neutral-700 overflow-y-auto bg-neutral-800 text-neutral-200">
        <header className="px-3 py-2 flex items-center justify-between border-b border-neutral-700 sticky top-0 bg-neutral-800 z-10">
          <span className="text-xs font-semibold tracking-wide">Content</span>
          <span className={`text-xs ${STATUS_COLOR[status] ?? ''}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </header>

        <section className="p-3">
          {page ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                Page {index + 1}
              </div>
              <label className="block mb-3">
                <span className="block text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                  Template
                </span>
                <select
                  value={page.template ?? ''}
                  onChange={(e) => switchTemplate(index, e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded text-xs px-2 py-1 text-neutral-100"
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
            <div className="text-xs text-neutral-500 italic">No page selected</div>
          )}
        </section>
      </aside>
    </div>
  )
}
