import { useValue } from '@tldraw/state-react'
import { useMemo } from 'react'

import { NEW_TEMPLATE_SOURCE } from '../../collab/compile'
import CodeEditor from '../fields/CodeEditor'
import { $currentIndex, $currentPage, $templates, switchTemplate } from '../store'
import { Button, EditorPane, Muted } from '../ui'
import { $collabBridge } from './room'
import { $docTemplateErrors, $docTemplateNames } from './templates-store'

/**
 * Shows the current slide's template. Doc-stored templates are edited live
 * (compiled at runtime for everyone in the room); theme/file templates are
 * read-only with an "Edit a copy" action that forks the source into a doc
 * template and points the slide at it.
 */
export default function TemplatesPanel() {
  const bridge = useValue($collabBridge)
  const page = useValue($currentPage)
  const index = useValue($currentIndex)
  const templates = useValue($templates)
  const docNames = useValue($docTemplateNames)
  const errors = useValue($docTemplateErrors)

  const name = page?.template
  const isDoc = !!name && docNames.includes(name)

  const collab = useMemo(() => {
    if (!bridge || !name || !isDoc) return undefined
    const ytext = bridge.getTemplateText(name)
    if (!ytext) return undefined
    return { ytext, awareness: bridge.awareness, undoManager: bridge.undoManager }
  }, [bridge, name, isDoc])

  if (!bridge || !page || !name) {
    return <Muted className="italic">No page selected</Muted>
  }

  const mod = templates[name]
  const compileError = errors[name]

  const forkName = () => {
    const used = new Set([...Object.keys(templates), ...docNames])
    if (!used.has('Custom')) return 'Custom'
    let n = 2
    while (used.has(`Custom${n}`)) n += 1
    return `Custom${n}`
  }

  const editACopy = () => {
    const newName = forkName()
    bridge.addTemplate(newName, mod?.source ?? NEW_TEMPLATE_SOURCE)
    switchTemplate(index, newName)
  }

  const header = (badge: string, action?: React.ReactNode) => (
    <div className="shrink-0 flex items-center justify-between gap-2">
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-mono-xs text-default truncate">{name}</span>
        <span className="text-mono-xs text-quaternary shrink-0">{badge}</span>
      </div>
      {action}
    </div>
  )

  // Doc-stored template: collaboratively editable.
  if (isDoc && collab) {
    return (
      <EditorPane error={compileError}>
        {header(
          'custom · live for everyone',
          <Button
            variant="destructive"
            onClick={() => bridge.removeTemplate(name)}
            className="shrink-0"
          >
            Delete
          </Button>,
        )}
        <CodeEditor key={name} collab={collab} language="tsx" hasError={!!compileError} />
      </EditorPane>
    )
  }

  // Unknown template name: offer to create it as a doc template.
  if (!mod) {
    return (
      <div className="flex flex-col gap-2">
        {header('missing')}
        <p className="text-mono-xs text-quaternary">
          This slide references a template that doesn’t exist.
        </p>
        <Button
          onClick={() => bridge.addTemplate(name, NEW_TEMPLATE_SOURCE)}
          className="self-start"
        >
          Create “{name}” as a custom template
        </Button>
      </div>
    )
  }

  // Theme or file template: read-only source with a fork action.
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="px-3 py-2 border-b">
        {header(
          'built-in · read-only',
          <Button onClick={editACopy} className="shrink-0">
            Edit a copy
          </Button>,
        )}
      </div>
      {mod.source ? (
        <CodeEditor key={name} value={mod.source} language="tsx" readOnly />
      ) : (
        <p className="text-mono-xs text-quaternary">
          Source isn’t available for this template. “Edit a copy” starts from a starter
          template instead.
        </p>
      )}
    </div>
  )
}
