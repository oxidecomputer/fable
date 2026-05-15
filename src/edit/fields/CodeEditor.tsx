import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { type FocusEvent, useEffect, useRef } from 'react'

import { endBypass, startBypass } from '../history'

type Props = {
  label?: string
  value: string
  onChange: (next: string) => void
  hasError?: boolean
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

const extensions = [
  markdown(),
  EditorView.lineWrapping,
  theme,
  syntaxHighlighting(highlightStyle),
]

export default function CodeEditor({ label, value, onChange, hasError }: Props) {
  // While CodeMirror has focus, bypass global history so its own per-keystroke
  // undo owns the session. On blur, the cumulative change lands as one entry.
  const focusedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (focusedRef.current) {
        focusedRef.current = false
        endBypass('cm-edit')
      }
    }
  }, [])

  const handleFocus = () => {
    if (focusedRef.current) return
    focusedRef.current = true
    startBypass()
  }

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    if (!focusedRef.current) return
    focusedRef.current = false
    endBypass('cm-edit')
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {label && <div className="text-mono-xs text-quaternary mb-1">{label}</div>}
      <div
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`flex-1 min-h-0 overflow-hidden rounded border focus-within:border-accent-secondary ${
          hasError ? 'border-destructive' : 'border-default'
        }`}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          theme="none"
          height="100%"
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightSelectionMatches: false,
            autocompletion: false,
            foldGutter: false,
            indentOnInput: true,
            history: true,
          }}
        />
      </div>
    </div>
  )
}
