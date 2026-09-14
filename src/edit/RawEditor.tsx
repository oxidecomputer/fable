import { useValue } from '@tldraw/state-react'
import { useMemo } from 'react'

import { $collabBridge } from './collab/room'
import CodeEditor from './fields/CodeEditor'
import { $currentPageId, $pageErrors } from './store'
import { EditorPane, Muted } from './ui'

/**
 * The page's full serialized source, bound directly to its Y.Text (remote
 * cursors included). Parse errors come from the bridge observer.
 */
export default function RawEditor() {
  const pageId = useValue($currentPageId)

  if (!pageId) {
    return <Muted className="italic">No page selected</Muted>
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
    return <Muted className="italic">No page selected</Muted>
  }

  return (
    <EditorPane error={parseError}>
      <CodeEditor collab={collab} hasError={!!parseError} />
    </EditorPane>
  )
}
