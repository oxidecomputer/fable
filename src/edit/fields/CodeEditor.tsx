import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { type FocusEvent, useMemo, useState } from 'react'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import type * as Y from 'yjs'

import { stopCapturing } from '../undo'

export type CollabBinding = {
  ytext: Y.Text
  awareness: unknown
  undoManager: Y.UndoManager
}

type Props = {
  label?: string
  value?: string
  onChange?: (next: string) => void
  hasError?: boolean
  /** Syntax highlighting mode. Default: 'markdown'. */
  language?: 'markdown' | 'tsx'
  readOnly?: boolean
  /**
   * 'fill' stretches to the available space (raw source / template editors);
   * 'auto' grows with content up to a cap (schema-form fields).
   */
  sizing?: 'fill' | 'auto'
  /**
   * When set, the editor is bound directly to a Y.Text via yCollab
   * (uncontrolled; remote cursors included) and CodeMirror's own history is
   * disabled in favor of the shared UndoManager. Remount (key) when the
   * bound Y.Text changes.
   */
  collab?: CollabBinding
}

const oxideDark = {
  background: '#080F11',
  foreground: '#E7E7E8',
  selection: '#274355',
  cursor: '#E7E7E8',
  lineHighlight: '#112228',
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#A1A4A5' },

  // Code (tsx)
  { tag: tags.keyword, color: '#F7869B' },
  { tag: tags.string, color: '#A7E0C8' },
  { tag: [tags.number, tags.bool, tags.null], color: '#EDD5A6' },
  { tag: [tags.typeName, tags.className], color: '#EDD5A6' },
  { tag: tags.propertyName, color: '#9DAFFA' },
  { tag: tags.function(tags.variableName), color: '#C6A5EA' },
  { tag: tags.tagName, color: '#F7869B' },
  { tag: tags.attributeName, color: '#88DCB7' },
  { tag: tags.operator, color: '#E7E7E8' },

  { tag: tags.heading, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.heading1, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#EDD5A6', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#EDD5A6', fontWeight: 'bold' },
  { tag: tags.heading4, color: '#88DCB7', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#9DAFFA', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#C6A5EA', fontWeight: 'bold' },

  { tag: tags.quote, color: '#EFB7C2' },
  { tag: tags.list, color: '#A7E0C8' },
  { tag: tags.emphasis, color: '#F7869B', fontStyle: 'italic' },
  { tag: tags.strong, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.strikethrough, color: '#A6ADC8', textDecoration: 'line-through' },

  { tag: tags.link, color: '#9DAFFA' },
  { tag: tags.url, color: '#88DCB7' },

  { tag: tags.monospace, color: '#68D9A7' },
  { tag: tags.processingInstruction, color: '#9DAFFA' },
  { tag: tags.meta, color: '#A7E0C8' },
  { tag: tags.invalid, color: '#FB6E88' },
])

const theme = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: oxideDark.background,
    color: oxideDark.foreground,
    fontFamily: 'GT America Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  '.cm-content': {
    paddingTop: '8px',
    paddingBottom: '8px',
    caretColor: oxideDark.cursor,
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: oxideDark.cursor,
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    {
      backgroundColor: oxideDark.selection + ' !important',
    },
  '.cm-activeLine': {
    backgroundColor: oxideDark.lineHighlight,
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--surface-secondary)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-raise)',
    borderColor: 'var(--stroke-default)',
    color: 'var(--content-quaternary)',
    minWidth: '1.5rem',
  },
})

const sharedExtensions = [
  EditorView.lineWrapping,
  theme,
  syntaxHighlighting(highlightStyle),
]

const languageExtension = {
  markdown: () => markdown(),
  tsx: () => javascript({ jsx: true, typescript: true }),
}

export default function CodeEditor({
  label,
  value,
  onChange,
  hasError,
  language = 'markdown',
  readOnly = false,
  sizing = 'fill',
  collab,
}: Props) {
  const isCollab = !!collab

  // yCollab keeps the view and Y.Text in sync but does not seed the initial
  // document — snapshot it once at mount (the parent remounts us per Y.Text).
  const [initialValue] = useState(() => collab?.ytext.toString())

  const extensions = useMemo(() => {
    const base = [languageExtension[language](), ...sharedExtensions]
    if (!collab) return base
    return [
      ...base,
      keymap.of(yUndoManagerKeymap),
      yCollab(collab.ytext, collab.awareness, { undoManager: collab.undoManager }),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, collab?.ytext, collab?.awareness, collab?.undoManager])

  // Close the shared undo capture group when leaving the editor so the next
  // edit starts a fresh undo step.
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    stopCapturing()
  }

  const fill = sizing === 'fill'
  return (
    <div className={fill ? 'flex flex-1 flex-col min-h-0' : 'mb-3'}>
      {label && <div className="text-mono-xs text-quaternary mb-1">{label}</div>}
      <div
        onBlur={handleBlur}
        className={`${
          fill ? 'flex-1 min-h-0' : ''
        } overflow-hidden focus-within:border-accent-secondary ${
          hasError ? 'border-destructive' : 'border-default'
        }`}
      >
        <CodeMirror
          value={isCollab ? initialValue : value}
          onChange={isCollab ? undefined : onChange}
          extensions={extensions}
          theme="none"
          height={fill ? '100%' : undefined}
          minHeight={fill ? undefined : '60px'}
          maxHeight={fill ? undefined : '40vh'}
          className={fill ? 'h-full' : ''}
          editable={!readOnly}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightSelectionMatches: false,
            autocompletion: false,
            foldGutter: false,
            indentOnInput: true,
            history: !isCollab,
          }}
        />
      </div>
    </div>
  )
}
