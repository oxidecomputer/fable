import { useValue } from '@tldraw/state-react'
import { useMemo } from 'react'

import { $collabBridge } from './collab/room'
import CodeEditor from './fields/CodeEditor'
import { $currentPageId, $pageErrors } from './store'

/**
 * The page's full serialized source, bound directly to its Y.Text (remote
 * cursors included). Parse errors come from the bridge observer.
 */
export default function RawEditor() {
  const pageId = useValue($currentPageId)

  if (!pageId) {
    return <div className="text-mono-xs text-quaternary italic">No page selected</div>
  }
  return <PageSource key={pageId} pageId={pageId} />
}

function PageSource({ pageId }: { pageId: string }) {
  const bridge = useValue($collabBridge)
  const parseError = useValue('pageError', () => $pageErrors.get()[pageId] ?? null, [
    pageId,
  ])
  const collab = useMemo(() => {
    const ytext = bridge?.getPageText(pageId)
    if (!bridge || !ytext) return undefined
    return { ytext, awareness: bridge.awareness, undoManager: bridge.undoManager }
  }, [bridge, pageId])

  if (!collab) {
    return <div className="text-mono-xs text-quaternary italic">No page selected</div>
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CodeEditor collab={collab} hasError={!!parseError} />
      {parseError && (
        <div className="shrink-0 mt-2 text-mono-xs text-destructive">{parseError}</div>
      )}
    </div>
  )
}
