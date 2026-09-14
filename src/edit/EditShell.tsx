import { useValue } from '@tldraw/state-react'
import { type ReactNode, useState } from 'react'
import { z } from 'zod'

import { missingFieldPlaceholders } from '../content/placeholders'
import { unwrapEffects } from '../templates/validation'
import PageList from './PageList'
import RawEditor from './RawEditor'
import Avatars from './collab/Avatars'
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
import { Button, NoticeBox, Select } from './ui'
import { useSchemaErrors } from './useSchemaErrors'

type Props = { children: ReactNode }

type Tab = 'source' | 'templates'

/**
 * A template's native variants: the options of a top-level `variant` enum
 * field in its schema, when it has one. `optional` adds a Default choice
 * (clearing the key so the template's own fallback applies).
 */
function variantOptions(
  schema: z.ZodTypeAny | undefined,
): { options: readonly string[]; optional: boolean } | null {
  const s = unwrapEffects(schema)
  if (!(s instanceof z.ZodObject)) return null
  let v: any = (s.shape as Record<string, z.ZodTypeAny>).variant
  let optional = false
  while (
    v instanceof z.ZodOptional ||
    v instanceof z.ZodNullable ||
    v instanceof z.ZodDefault
  ) {
    optional = true
    v = v._def.innerType
  }
  return v instanceof z.ZodEnum ? { options: v.options, optional } : null
}

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
  const [tab, setTab] = useState<Tab>('source')

  const parseError = pageId ? pageErrors[pageId] : undefined

  const template = page ? templates[page.template] : undefined
  const errors = useSchemaErrors(template, page ?? { template: '' })
  // Split "field has no value" from real mistakes: the former gets a one-click
  // fix that writes placeholders into the page source.
  const missing =
    errors?.filter(
      (e) => e.code === 'invalid_type' && e.received === 'undefined' && e.path.length === 1,
    ) ?? []
  const otherErrors = errors?.filter((e) => !missing.includes(e)) ?? []
  const variants = variantOptions(template?.Schema)

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
        {otherErrors.length > 0 && (
          <NoticeBox className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[80%] px-3 py-1.5 text-sans-sm backdrop-blur-sm shadow-lg">
            <div className="font-medium mb-0.5">
              {otherErrors.length} schema {otherErrors.length === 1 ? 'issue' : 'issues'}
            </div>
            <ul className="space-y-0.5">
              {otherErrors.map((e, i) => (
                <li key={i}>
                  <code>{e.path.join('.') || '(root)'}</code> — {e.message}
                </li>
              ))}
            </ul>
          </NoticeBox>
        )}
      </div>

      <aside
        style={{ width: inspectorWidth }}
        className="relative shrink-0 flex flex-col border-l border-default bg-raise text-default"
      >
        <ResizeHandle />
        {page && (
          <div className="shrink-0 p-3 border-b border-default">
            <div className="flex gap-2">
              <Select
                value={page.template ?? ''}
                disabled={!!parseError}
                title={
                  parseError
                    ? 'Page source is currently unparseable (someone may be mid-edit)'
                    : undefined
                }
                onChange={(e) => switchTemplate(index, e.target.value)}
                className="flex-1 min-w-0"
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
              </Select>
              {variants && (
                <Select
                  value={typeof page.variant === 'string' ? page.variant : ''}
                  disabled={!!parseError}
                  onChange={(e) => updatePage(index, { variant: e.target.value })}
                  className="shrink-0"
                >
                  {variants.optional && <option value="">Default</option>}
                  {variants.options.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {missing.length > 0 && (
              <NoticeBox className="mt-2 px-2 py-1.5 text-mono-xs">
                <div className="mb-1.5">
                  Missing {missing.length === 1 ? 'field' : 'fields'}:{' '}
                  <code>{missing.map((e) => e.path[0]).join(', ')}</code>
                </div>
                <Button
                  variant="notice"
                  onClick={() =>
                    updatePage(
                      index,
                      missingFieldPlaceholders(template?.Schema, page ?? {}),
                    )
                  }
                >
                  Insert placeholders
                </Button>
              </NoticeBox>
            )}
          </div>
        )}
        <header className="shrink-0 flex items-center border-b border-default bg-raise">
          <TabButton active={tab === 'source'} onClick={() => setTab('source')}>
            Source
          </TabButton>
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
            Template
          </TabButton>
        </header>

        <section className="flex-1 min-h-0 flex flex-col p-3">
          {tab === 'source' ? <RawEditor /> : <TemplatesPanel />}
        </section>
      </aside>
    </div>
  )
}
