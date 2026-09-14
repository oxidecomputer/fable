import { shallow, useOthers, useUpdateMyPresence } from '@liveblocks/react'
import { useValue } from '@tldraw/state-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import Page from './Page'
import { imageFieldKeys } from './collab/fields'
import { DeckSelectHost, DeckSelectModal } from './edit/DeckSelect'
import EditShell from './edit/EditShell'
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
  $viewSettings,
  setCurrentIndex,
  toggleViewSetting,
  updatePage,
} from './edit/store'
import { CenteredNotice, Muted } from './edit/ui'
import { redo, undo } from './edit/undo'
import { FilesContext, createFilesClient, useFiles } from './files'
import { useKey } from './hooks/use-key'
import type { DeckContent, TemplateMap } from './model'
import { installImageDragTracking } from './templates/image-drag'
import { resolveTemplates } from './templates/registry'
import type { Theme } from './theme'
import oxcon26Theme from './themes/oxcon26'

export const Schema = z.object({
  pages: z.any().array(),
})

type Props = {
  customTemplates?: TemplateMap
  /** The deck directory's theme (FABLE_THEME, resolved by the plugin). */
  theme?: Theme
  /**
   * Collab availability (auth + deck-listing endpoints). The directory is
   * the theme; decks live in rooms, picked by URL (?deck=<id> or the first
   * path segment). The bare URL shows an empty editor frame with the
   * deck-select modal forced open.
   */
  collab?: {
    authEndpoint: string
    decksEndpoint: string
    /** Room-file endpoints (upload + presigned-URL redirect) for slide images. */
    filesEndpoint?: string
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

export default function App({ customTemplates = {}, collab, theme = oxcon26Theme }: Props) {
  const mode = useValue($mode)

  const templates = useMemo(
    () => resolveTemplates({ theme: theme.templates, files: customTemplates }).templates,
    [theme, customTemplates],
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
      <CenteredNotice>
        <Muted className="max-w-[440px] p-6 border border-default rounded bg-raise">
          Fable needs a backend: set <code>LIVEBLOCKS_SECRET_KEY</code> for local dev, or
          build with <code>VITE_FABLE_API_URL</code> pointing at a fable server.
        </Muted>
      </CenteredNotice>
    )
  }

  if (!roomId) {
    // No deck selected: keep the editor frame (empty) with the deck-select
    // modal forced open (no onClose) on top.
    return (
      <>
        <EditShell presence={false}>
          <div className="w-full h-full bg-[#333]" />
        </EditShell>
        <DeckSelectModal config={collab} />
      </>
    )
  }

  return (
    <CollabRoot
      config={{
        roomId,
        authEndpoint: collab.authEndpoint,
        apiToken: collab.apiToken,
      }}
      baseTemplates={templates}
      templateExports={theme.templateExports}
    >
      <RoomFilesProvider
        roomId={roomId}
        filesEndpoint={collab.filesEndpoint}
        apiToken={collab.apiToken}
      >
        {effectiveMode === 'edit' ? (
          <EditView theme={theme} />
        ) : (
          <LivePresentView isPdf={isPdf} />
        )}
      </RoomFilesProvider>
      <DeckSelectHost config={collab} currentDeckId={roomId} />
    </CollabRoot>
  )
}

/** Room-file resolution/upload for `fable:<fileId>` image refs. */
function RoomFilesProvider({
  roomId,
  filesEndpoint,
  apiToken,
  children,
}: {
  roomId: string
  filesEndpoint?: string
  apiToken?: string
  children: ReactNode
}) {
  const files = useMemo(
    () => (filesEndpoint ? createFilesClient(filesEndpoint, roomId, apiToken) : null),
    [filesEndpoint, roomId, apiToken],
  )
  return <FilesContext.Provider value={files}>{children}</FilesContext.Provider>
}

/** Present mode against the live room state instead of the static build. */
function LivePresentView({ isPdf }: { isPdf: boolean }) {
  const deck = useValue($deck)
  const templates = useValue($templates)
  return (
    <PresentView
      content={deck}
      templates={templates}
      isPdf={isPdf}
      onExit={(page) => {
        setCurrentIndex(page)
        $mode.set('edit')
      }}
    />
  )
}

function PresentView({
  content,
  templates,
  isPdf,
  onExit,
}: {
  content: DeckContent
  templates: TemplateMap
  isPdf: boolean
  /** Leave present mode (fullscreen exited or Escape), landing on `page`. */
  onExit?: (page: number) => void
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

  const exit = () => {
    if (document.fullscreenElement) {
      // fullscreenchange handles the mode switch back to edit.
      document.exitFullscreen()
    } else {
      onExit?.(currentPage)
    }
  }

  useKey('left', prevPage)
  useKey('right', nextPage)
  useKey('up', prevPage)
  useKey('down', nextPage)
  useKey('f', enterFullscreen)
  useKey('esc', exit)

  useEffect(() => {
    function onFullscreenChange() {
      const fullscreen = document.fullscreenElement !== null
      setIsFullscreen(fullscreen)
      if (!fullscreen) onExit?.(currentPage)
    }
    addEventListener('fullscreenchange', onFullscreenChange)
    return () => removeEventListener('fullscreenchange', onFullscreenChange)
  })

  useEffect(() => {
    function checkScale() {
      const widthScale = window.innerWidth / 1920
      const heightScale = window.innerHeight / 1080
      setScale(widthScale < heightScale ? widthScale : heightScale)
    }

    checkScale()

    if (isPdf) {
      document.body.classList.add('--pdf')
    }

    addEventListener('resize', checkScale)
    return () => removeEventListener('resize', checkScale)
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
            mode="present"
            templates={templates}
            pageNumber={showPageNumbers ? pageNumber(i + 1) : null}
            pageInfo={{ number: i + 1, total: content.pages.length }}
          />
        ))
      ) : (
        <Page
          key={currentPage}
          data={content.pages[currentPage]}
          scale={scale * (isFullscreen ? 1.0 : 0.9)}
          mode="present"
          templates={templates}
          pageNumber={showPageNumbers ? pageNumber(currentPage + 1) : null}
          pageInfo={{ number: currentPage + 1, total: content.pages.length }}
        />
      )}
    </div>
  )
}

function EditView({ theme }: { theme: Theme }) {
  const deck = useValue($deck)
  const viewSettings = useValue($viewSettings)
  const templates = useValue($templates)
  const currentIndex = useValue($currentIndex)
  const currentPageId = useValue($currentPageId)
  const inspectorWidth = useValue($inspectorWidth)
  const [scale, setScale] = useState(1.0)
  const files = useFiles()
  const [uploading, setUploading] = useState(false)

  // Canvas field selection presence: publish ours, collect others' (same
  // slide only) as fieldKey → user color for the stage to outline.
  const updateMyPresence = useUpdateMyPresence()
  const remoteFieldSelections = useOthers((others) => {
    const map: Record<string, string> = {}
    for (const o of others) {
      if (o.presence.pageId === currentPageId && o.presence.editingField) {
        map[o.presence.editingField] = o.info?.color ?? '#9DAFFA'
      }
    }
    return map
  }, shallow)

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
    url.hash = '' // present mode's #<slide> hash, stale once back in edit
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

  // Present the current slide, taking over the screen. Exiting fullscreen
  // (or Escape) returns to edit mode via LivePresentView's onExit.
  const present = () => {
    window.location.hash = String($currentIndex.get() + 1)
    $mode.set('present')
    document.body.requestFullscreen().catch(() => {})
  }
  useKey('f', present)

  // View settings: "g" toggles the theme's grid overlay on the edit stage.
  useKey('g', () => toggleViewSetting('grid'))

  // Track image drags over the window so image fields (SlideImage) can
  // show their dashed drop-target outline.
  useEffect(() => (files ? installImageDragTracking() : undefined), [files])

  const showPageNumbers = !!deck.config?.page_numbers
  const data = deck.pages[currentIndex]
  const total = deck.pages.length
  const GridOverlay = theme.gridOverlay

  // Fallback for drops that miss a specific field: upload to the room and
  // set the slide's image field (the first empty one, else the first).
  // Field-level targets (SlideImage) handle their own drops and stop
  // propagation before this fires.
  const dropImage = async (e: React.DragEvent) => {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file || !files || !data) return
    e.preventDefault()
    const keys = imageFieldKeys(templates[data.template]?.Schema)
    if (keys.length === 0) return
    const field = keys.find((k) => !data[k]) ?? keys[0]
    setUploading(true)
    try {
      const ref = await files.upload(file)
      updatePage($currentIndex.get(), { [field]: ref })
    } catch (err) {
      console.error('Image upload failed', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <EditShell>
      <div
        className="w-full h-full relative bg-[#333]"
        onDragOver={(e) => {
          if (files && e.dataTransfer.types.includes('Files')) e.preventDefault()
        }}
        onDrop={dropImage}
      >
        {data ? (
          <Page
            key={currentPageId ?? currentIndex}
            data={data}
            scale={scale}
            templates={templates}
            pageInfo={{ number: currentIndex + 1, total }}
            overlay={viewSettings.grid && GridOverlay ? <GridOverlay /> : undefined}
            onEditField={(field, value, index) => {
              if (index === undefined) {
                updatePage($currentIndex.get(), { [field]: value })
                return
              }
              // Array item: "field" replaces a string item, "field.key" a key
              // within an object item (e.g. StatRows' rows.stat).
              const [arrayField, subKey] = field.split('.')
              const current = ($currentPage.get() as any)?.[arrayField]
              const items = Array.isArray(current) ? current.slice() : []
              items[index] = subKey ? { ...items[index], [subKey]: value } : value
              updatePage($currentIndex.get(), { [arrayField]: items })
            }}
            onEditingField={(fieldKey) => updateMyPresence({ editingField: fieldKey })}
            remoteFieldSelections={remoteFieldSelections}
            pageNumber={
              showPageNumbers ? (
                <div className="absolute bottom-[40px] right-[40px] opacity-40 text-sans-sm">
                  {currentIndex + 1} / {total}
                </div>
              ) : null
            }
          />
        ) : (
          <Muted className="absolute inset-0 flex items-center justify-center">
            No pages — click “new slide” in the sidebar.
          </Muted>
        )}
        {uploading && (
          <Muted className="absolute bottom-3 left-3 z-10">Uploading image…</Muted>
        )}
      </div>
    </EditShell>
  )
}
