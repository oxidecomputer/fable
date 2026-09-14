import { useValue } from '@tldraw/state-react'
import { marked } from 'marked'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ComponentProps, ReactNode } from 'react'

import { FILE_REF_PREFIX, FilesContext, useImageSrc } from '../files'
import { highlightCode } from './highlight'
import { $imageDragActive, droppedImage } from './image-drag'

/**
 * Provided by the edit stage so text fields become directly editable on the
 * canvas. Templates opt fields in by passing `field` to {@link Markdown}.
 */
export const CanvasEditContext = createContext<{
  update: (field: string, value: string, index?: number) => void
  /** Publish which field this client is editing on the canvas (null = none). */
  setEditing?: (fieldKey: string | null) => void
  /** Fields collaborators have selected on this slide: fieldKey → their color. */
  remoteSelections?: Record<string, string>
} | null>(null)

/** Presence key for a canvas field: `field` or `field:index` for array items. */
export const fieldKey = (field: string, index?: number) =>
  index === undefined ? field : `${field}:${index}`

/**
 * Drop-target behavior for fields that can receive a dragged image (edit
 * stage only). While an image drag is in flight every enabled target shows a
 * dashed accent outline (`fable-droppable`), solid while directly hovered
 * (`fable-droppable-over`); dropping hands the file to `onFile`.
 */
type DropTargetProps = {
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

function useImageDropTarget(onFile: ((file: File) => void) | null): {
  className: string
  props: DropTargetProps
} {
  const dragActive = useValue($imageDragActive)
  const [over, setOver] = useState(false)
  if (!onFile || !dragActive) return { className: '', props: {} }
  return {
    className: ` fable-droppable${over ? ' fable-droppable-over' : ''}`,
    props: {
      onDragOver: (e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      },
      onDrop: (e) => {
        const file = droppedImage(e)
        if (!file) return
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onFile(file)
      },
    },
  }
}

/**
 * An image field's `<img>`: resolves `fable:` refs like {@link useImageSrc}
 * and, on the edit stage, acts as a drop target — dragging an image over the
 * editor outlines it, dropping uploads to the room and sets `field`.
 */
export const SlideImage = ({
  value,
  field,
  className = '',
  alt = '',
  ...imgProps
}: Omit<ComponentProps<'img'>, 'src'> & {
  /** The image field's value (URL, public/ path, or fable:<fileId>). */
  value?: string
  /** Page field the value came from — enables drop-to-replace on the stage. */
  field?: string
}) => {
  const src = useImageSrc(value)
  const canvasEdit = useContext(CanvasEditContext)
  const files = useContext(FilesContext)
  const drop = useImageDropTarget(
    canvasEdit && files && field
      ? (file) =>
          files
            .upload(file)
            .then((ref) => canvasEdit.update(field, ref))
            .catch((err) => console.error('Image upload failed', err))
      : null,
  )
  return (
    <img
      src={src}
      alt={alt}
      className={`${className}${drop.className}`}
      {...drop.props}
      {...imgProps}
    />
  )
}

export const Markdown = ({
  content,
  className = '',
  field,
  fieldIndex,
  images,
}: {
  content: string
  className?: string
  /** Page field this text renders — enables in-canvas editing on the stage. */
  field?: string
  /** For string-array fields: the index this text renders. */
  fieldIndex?: number
  /**
   * The field accepts inline images (pair with `markdownField({ images:
   * true })` in the schema) — pasting an image while editing in-canvas
   * uploads it to the room and inserts the `fable:` ref.
   */
  images?: boolean
}) => {
  const canvasEdit = useContext(CanvasEditContext)
  if (canvasEdit && field) {
    return (
      <EditableMarkdown
        content={content}
        className={className}
        field={field}
        fieldIndex={fieldIndex}
        images={images}
        update={canvasEdit.update}
        setEditing={canvasEdit.setEditing}
        remoteColor={canvasEdit.remoteSelections?.[fieldKey(field, fieldIndex)]}
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
  remoteColor,
}: {
  content: string
  className: string
  onClick?: () => void
  editable?: boolean
  /** A collaborator has this field selected — outline in their color. */
  remoteColor?: string
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const files = useContext(FilesContext)

  const html = useMemo(() => {
    const out = marked.parse(content, {
      // breaks: a newline is a line break (<br>), a blank line a new
      // paragraph — matching what typing Enter in the inputs suggests.
      breaks: true,
    }) as string
    // Inline images may reference room-stored files (![alt](fable:<fileId>));
    // rewrite their srcs to the file backend's stable URLs.
    if (!out.includes(FILE_REF_PREFIX)) return out
    return out.replace(new RegExp(`src="(${FILE_REF_PREFIX}[^"]*)"`, 'g'), (_, ref) => {
      const url = files ? files.fileUrl(ref) : ''
      return `src="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
    })
  }, [content, files])

  // Highlight fenced code blocks in place: shiki tokenizes the block's plain
  // text (async — the grammar loads on first use) and its inline spans replace
  // the escaped source. React re-sets the wrapper's innerHTML whenever `html`
  // changes, so stale highlights never survive an edit.
  useEffect(() => {
    if (!wrapper.current) return
    let cancelled = false
    wrapper.current.querySelectorAll('pre code').forEach((el) => {
      const lang = /language-([\w-]+)/.exec(el.className)?.[1] ?? 'text'
      const code = (el.textContent ?? '').replace(/\n$/, '')
      highlightCode(code, lang).then(
        (tokens) => {
          if (!cancelled) el.innerHTML = tokens
        },
        (err) => console.error('Highlighting failed', err),
      )
    })
    return () => {
      cancelled = true
    }
  }, [html])

  return (
    <div
      ref={wrapper}
      onClick={onClick}
      className={`markdown ${className}${editable ? ' fable-editable' : ''}${
        remoteColor ? ' fable-editable-remote' : ''
      }`}
      style={
        remoteColor ? ({ '--fable-remote-color': remoteColor } as CSSProperties) : undefined
      }
      dangerouslySetInnerHTML={{ __html: html }}
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
  images,
  update,
  setEditing: publishEditing,
  remoteColor,
}: {
  content: string
  className: string
  field: string
  fieldIndex?: number
  images?: boolean
  update: (field: string, value: string, index?: number) => void
  setEditing?: (fieldKey: string | null) => void
  remoteColor?: string
}) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const files = useContext(FilesContext)

  // Tell collaborators which field we're in; cleared on blur/escape/unmount.
  useEffect(() => {
    if (!editing || !publishEditing) return
    publishEditing(fieldKey(field, fieldIndex))
    return () => publishEditing(null)
  }, [editing, field, fieldIndex, publishEditing])

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
        remoteColor={remoteColor}
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
        e.preventDefault()
        // Image-enabled fields accept a pasted image: upload it to the room
        // and insert the markdown ref at the caret.
        const image =
          images && files
            ? Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
            : undefined
        if (image) {
          files!
            .upload(image)
            .then((ref) => document.execCommand('insertText', false, `![](${ref})`))
            .catch((err) => console.error('Image upload failed', err))
          return
        }
        // Keep it plaintext — strip formatting from pasted content.
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
