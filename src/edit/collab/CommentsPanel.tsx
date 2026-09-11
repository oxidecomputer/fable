import { useThreads } from '@liveblocks/react'
import { Composer, Thread } from '@liveblocks/react-ui'
import '@liveblocks/react-ui/styles.css'
import '@liveblocks/react-ui/styles/dark/attributes.css'
import { useValue } from '@tldraw/state-react'

import { $currentPageId } from '../store'

/** Per-slide comment threads (collab mode inspector tab). */
export default function CommentsPanel() {
  const pageId = useValue($currentPageId)

  if (!pageId) {
    return <div className="text-mono-xs text-quaternary italic">No page selected</div>
  }
  return <PageThreads key={pageId} pageId={pageId} />
}

function PageThreads({ pageId }: { pageId: string }) {
  const { threads, error, isLoading } = useThreads({
    query: { metadata: { pageId } },
  })

  if (isLoading) {
    return <div className="text-mono-xs text-quaternary italic">Loading comments…</div>
  }
  if (error) {
    return (
      <div className="text-mono-xs text-destructive">
        Failed to load comments: {error.message}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0" data-theme="dark">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {threads.length === 0 && (
          <div className="text-mono-xs text-quaternary italic">
            No comments on this slide yet.
          </div>
        )}
        {threads.map((thread) => (
          <Thread
            key={thread.id}
            thread={thread}
            className="rounded border border-default"
          />
        ))}
      </div>
      <Composer
        metadata={{ pageId }}
        className="shrink-0 mt-3 rounded border border-default"
      />
    </div>
  )
}
