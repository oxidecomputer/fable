import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import Page from './Page'
import type { TemplateMap } from './Page'
import DeckIndex from './edit/DeckIndex'
import EditShell from './edit/EditShell'
import StageCursors from './edit/collab/StageCursors'
import { CollabRoot } from './edit/collab/room'
import {
  $currentIndex,
  $currentPage,
  $currentPageId,
  $deck,
  $inspectorWidth,
  $mode,
  $pageIds,
  $templates,
  setCurrentIndex,
  updatePage,
} from './edit/store'
import { redo, undo } from './edit/undo'
import { useKey } from './hooks/use-key'
import oxideTheme from './themes/oxide'

export const Schema = z.object({
  pages: z.any().array(),
})

type Content = {
  pages: any[]
  title?: string
  config?: { page_numbers?: boolean }
}

type Props = {
  customTemplates?: TemplateMap
  /**
   * Collab availability (auth + deck-listing endpoints). The directory is
   * the theme; decks live in rooms, picked by URL (?deck=<id> or the first
   * path segment). The bare URL shows the deck index.
   */
  collab?: {
    authEndpoint: string
    decksEndpoint: string
    apiToken?: string
  }
}

const PAGE_LIST_WIDTH = 300

/**
 * The deck (= Liveblocks room id) named by the URL: ?deck=<id> wins, else
 * the first path segment (`/my-deck`). Segments with a dot are files, not
 * deck ids.
 */
function deckIdFromUrl(): string | null {
  const url = new URL(window.location.href)
  const param = url.searchParams.get('deck')
  if (param) return param
  const segment = url.pathname.split('/').filter(Boolean)[0]
  if (segment && !segment.includes('.')) return decodeURIComponent(segment)
  return null
}

export default function App({ customTemplates = {}, collab }: Props) {
  const mode = useValue($mode)

  const templates = useMemo(
    () => ({ ...oxideTheme.templates, ...customTemplates }),
    [customTemplates],
  )

  const { isPdf, urlPresent } = useMemo(() => {
    const params = new URL(document.location.toString()).searchParams
    return {
      isPdf: params.get('pdf') !== null,
      // ?present (and ?pdf, used by MCP screenshots) force present mode.
      urlPresent: params.get('present') !== null,
    }
  }, [])

  const effectiveMode = isPdf || urlPresent ? 'present' : mode

  const roomId = useMemo(() => deckIdFromUrl(), [])

  if (!collab) {
    return (
      <div className="fable-editor flex h-full items-center justify-center bg-default">
        <div className="max-w-[440px] text-mono-xs text-quaternary p-6 border border-default rounded bg-raise">
          Fable needs a backend: set <code>LIVEBLOCKS_SECRET_KEY</code> for local dev, or
          build with <code>VITE_FABLE_API_URL</code> pointing at a fable server.
        </div>
      </div>
    )
  }

  if (!roomId) return <DeckIndex config={collab} />

  return (
    <CollabRoot
      config={{
        roomId,
        authEndpoint: collab.authEndpoint,
        apiToken: collab.apiToken,
      }}
      baseTemplates={templates}
    >
      {effectiveMode === 'edit' ? <EditView /> : <LivePresentView isPdf={isPdf} />}
    </CollabRoot>
  )
}

/** Present mode against the live room state instead of the static build. */
function LivePresentView({ isPdf }: { isPdf: boolean }) {
  const deck = useValue($deck)
  const templates = useValue($templates)
  return <PresentView content={deck} templates={templates} isPdf={isPdf} />
}

function PresentView({
  content,
  templates,
  isPdf,
}: {
  content: Content
  templates: TemplateMap
  isPdf: boolean
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scale, setScale] = useState(1.0)
  const [currentPage, setCurrentPage] = useState(0)

  useMemo(() => Schema.parse(content), [content])

  const prevPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1
      window.location.href = `#${newPage + 1}`
      setCurrentPage(newPage)
    }
  }

  const nextPage = () => {
    if (currentPage < content.pages.length - 1) {
      const newPage = currentPage + 1
      window.location.href = `#${newPage + 1}`
      setCurrentPage(newPage)
    }
  }

  const enterFullscreen = () => {
    document.body.requestFullscreen()
  }

  useKey('left', prevPage)
  useKey('right', nextPage)
  useKey('up', prevPage)
  useKey('down', nextPage)
  useKey('f', enterFullscreen)

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement !== null)
    }

    function checkScale() {
      const widthScale = window.innerWidth / 1920
      const heightScale = window.innerHeight / 1080
      setScale(widthScale < heightScale ? widthScale : heightScale)
    }

    checkScale()

    if (isPdf) {
      document.body.classList.add('--pdf')
    }

    addEventListener('fullscreenchange', onFullscreenChange)
    addEventListener('resize', checkScale)

    return () => {
      removeEventListener('fullscreenchange', onFullscreenChange)
      removeEventListener('resize', checkScale)
    }
  }, [isPdf])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return

    const page = parseInt(hash)
    if (page <= content.pages.length) {
      setCurrentPage(page - 1)
    }
  }, [content])

  const showPageNumbers = !!content.config?.page_numbers
  const pageNumber = (n: number) => (
    <div className="absolute bottom-[40px] right-[40px] opacity-40 text-sans-sm">
      {n} / {content.pages.length}
    </div>
  )

  return (
    <div className={`w-full h-full relative ${isFullscreen ? 'bg-default' : 'bg-[#333]'}`}>
      {isPdf ? (
        content.pages.map((data, i) => (
          <Page
            key={i}
            data={data}
            scale={1}
            templates={templates}
            pageNumber={showPageNumbers ? pageNumber(i + 1) : null}
          />
        ))
      ) : (
        <Page
          key={currentPage}
          data={content.pages[currentPage]}
          scale={scale * (isFullscreen ? 1.0 : 0.9)}
          templates={templates}
          pageNumber={showPageNumbers ? pageNumber(currentPage + 1) : null}
        />
      )}
    </div>
  )
}

function EditView() {
  const deck = useValue($deck)
  const templates = useValue($templates)
  const currentIndex = useValue($currentIndex)
  const currentPageId = useValue($currentPageId)
  const inspectorWidth = useValue($inspectorWidth)
  const [scale, setScale] = useState(1.0)

  useEffect(() => {
    function checkScale() {
      const stageWidth = window.innerWidth - PAGE_LIST_WIDTH - inspectorWidth
      const widthScale = stageWidth / 1920
      const heightScale = window.innerHeight / 1080
      setScale((widthScale < heightScale ? widthScale : heightScale) * 0.9)
    }
    checkScale()
    addEventListener('resize', checkScale)
    return () => removeEventListener('resize', checkScale)
  }, [inspectorWidth])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (deck.pages.length === 0) {
      url.searchParams.delete('page')
    } else {
      url.searchParams.set('page', String(currentIndex + 1))
    }
    window.history.replaceState(null, '', url.toString())
  }, [currentIndex, deck.pages.length])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      // Defer to CodeMirror (yUndoManagerKeymap routes to the same shared
      // UndoManager) and to native undo inside in-canvas text editing.
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.cm-editor')) return
      if (target?.isContentEditable) return
      e.preventDefault()
      e.stopPropagation()
      if (key === 'y' || (key === 'z' && e.shiftKey)) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const prevPage = () => {
    setCurrentIndex($currentIndex.get() - 1)
  }
  const nextPage = () => {
    const i = $currentIndex.get()
    if (i < $pageIds.get().length - 1) setCurrentIndex(i + 1)
  }
  useKey('left', prevPage)
  useKey('right', nextPage)
  useKey('up', prevPage)
  useKey('down', nextPage)

  const showPageNumbers = !!deck.config?.page_numbers
  const data = deck.pages[currentIndex]
  const total = deck.pages.length

  return (
    <EditShell>
      <div className="w-full h-full relative bg-[#333]">
        {data ? (
          <Page
            key={currentPageId ?? currentIndex}
            data={data}
            scale={scale}
            templates={templates}
            onEditField={(field, value, index) => {
              if (index === undefined) {
                updatePage($currentIndex.get(), { [field]: value })
                return
              }
              // String-array item: patch the array with the item replaced.
              const current = ($currentPage.get() as any)?.[field]
              const items = Array.isArray(current) ? current.slice() : []
              items[index] = value
              updatePage($currentIndex.get(), { [field]: items })
            }}
            pageNumber={
              showPageNumbers ? (
                <div className="absolute bottom-[40px] right-[40px] opacity-40 text-sans-sm">
                  {currentIndex + 1} / {total}
                </div>
              ) : null
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-quaternary text-mono-xs">
            No pages — click “new slide” in the sidebar.
          </div>
        )}
        <StageCursors scale={scale} />
      </div>
    </EditShell>
  )
}
