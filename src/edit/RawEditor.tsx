import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { parsePage, serializePage } from '../content/markdown'
import CodeEditor from './fields/CodeEditor'
import { $currentIndex, $currentPage, setPage } from './store'

export default function RawEditor() {
  const page = useValue($currentPage)
  const index = useValue($currentIndex)

  const serialized = useMemo(() => (page ? serializePage(page) : ''), [page])
  const lastSerialized = useRef(serialized)
  const [text, setText] = useState(serialized)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    if (serialized !== lastSerialized.current) {
      lastSerialized.current = serialized
      setText(serialized)
      setParseError(null)
    }
  }, [serialized])

  if (!page) {
    return <div className="text-mono-xs text-quaternary italic">No page selected</div>
  }

  const handleChange = (next: string) => {
    setText(next)
    // Ignore echoes from external value syncs (e.g. undo applied a new page).
    if (next === lastSerialized.current) {
      setParseError(null)
      return
    }
    try {
      const parsed = parsePage(next)
      lastSerialized.current = serializePage(parsed)
      setPage(index, parsed)
      setParseError(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CodeEditor value={text} onChange={handleChange} hasError={!!parseError} />
      {parseError && (
        <div className="shrink-0 mt-2 text-mono-xs text-destructive">{parseError}</div>
      )}
    </div>
  )
}
