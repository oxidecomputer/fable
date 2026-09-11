import hljs from 'highlight.js'
import { marked } from 'marked'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/**
 * Provided by the edit stage so text fields become directly editable on the
 * canvas. Templates opt fields in by passing `field` to {@link Markdown}.
 */
export const CanvasEditContext = createContext<{
  update: (field: string, value: string, index?: number) => void
} | null>(null)

export const Markdown = ({
  content,
  className = '',
  field,
  fieldIndex,
}: {
  content: string
  className?: string
  /** Page field this text renders — enables in-canvas editing on the stage. */
  field?: string
  /** For string-array fields: the index this text renders. */
  fieldIndex?: number
}) => {
  const canvasEdit = useContext(CanvasEditContext)
  if (canvasEdit && field) {
    return (
      <EditableMarkdown
        content={content}
        className={className}
        field={field}
        fieldIndex={fieldIndex}
        update={canvasEdit.update}
      />
    )
  }
  return <RenderedMarkdown content={content} className={className} />
}

function RenderedMarkdown({
  content,
  className,
  onClick,
  editable,
}: {
  content: string
  className: string
  onClick?: () => void
  editable?: boolean
}) {
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wrapper || !wrapper.current) return

    const elements = wrapper.current.querySelectorAll('pre code')

    if (elements) {
      elements.forEach((el) => {
        hljs.highlightElement(el as HTMLElement)
      })
    }
  }, [content])

  return (
    <div
      ref={wrapper}
      onClick={onClick}
      className={`markdown ${className}${editable ? ' fable-editable' : ''}`}
      dangerouslySetInnerHTML={{
        __html: marked.parse(content),
      }}
    />
  )
}

/**
 * In-canvas field editing: rendered markdown until clicked, then a plaintext
 * contentEditable holding the raw field source. Commits on blur through the
 * normal backend (synced + undoable); Escape cancels. While focused the
 * element is uncontrolled, so remote edits don't fight the caret — the blur
 * commit patches only this field.
 */
function EditableMarkdown({
  content,
  className,
  field,
  fieldIndex,
  update,
}: {
  content: string
  className: string
  field: string
  fieldIndex?: number
  update: (field: string, value: string, index?: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!editing || !editorRef.current) return
    const el = editorRef.current
    el.textContent = content
    el.focus()
    // Caret at the end — the click point is lost in the rendered→raw swap.
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    return (
      <RenderedMarkdown
        content={content}
        className={className}
        editable
        onClick={() => setEditing(true)}
      />
    )
  }

  const commit = () => {
    const next =
      editorRef.current?.innerText
        .replace(/\u00a0/g, ' ')
        // contentEditable leaves a trailing <br> → phantom final newline
        .replace(/\n$/, '') ?? content
    setEditing(false)
    if (next !== content) update(field, next, fieldIndex)
  }

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`${className} fable-editable fable-editable-active whitespace-pre-wrap outline-none`}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          if (editorRef.current) editorRef.current.textContent = content
          setEditing(false)
        }
      }}
      onPaste={(e) => {
        // Keep it plaintext — strip formatting from pasted content.
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
    />
  )
}

interface FitTextProps {
  children: ReactNode
  className?: string
}

export const FitText = ({ children, className = '' }: FitTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState<number>()
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const fitTextToContainer = () => {
      if (containerRef.current && textRef.current) {
        if (!fontSize) {
          const size = parseFloat(
            window.getComputedStyle(textRef.current, null).getPropertyValue('font-size') ||
              '120',
          )

          setFontSize(size)
          return
        }

        const containerHeight = containerRef.current.offsetHeight
        const textHeight = textRef.current.offsetHeight

        if (textHeight > containerHeight) {
          setFontSize(fontSize * 0.9)
        } else {
          setVisible(true)
        }
      }
    }

    fitTextToContainer()
  }, [fontSize])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className} ${visible ? '' : 'invisible'}`}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div ref={textRef} className="absolute top-0 left-0 right-0">
        {children}
      </div>
    </div>
  )
}
