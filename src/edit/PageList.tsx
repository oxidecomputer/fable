import { useValue } from '@tldraw/state-react'
import { type KeyboardEvent, memo, useEffect, useRef } from 'react'

import Page, { type TemplateMap } from '../Page'
import { openDeckSelect } from './DeckSelect'
import { PagePresenceDots } from './collab/Avatars'
import {
  $currentIndex,
  $deck,
  $dragIndex,
  $filenames,
  $overIndex,
  $pageIds,
  $templates,
  $title,
  type PageData,
  addPage,
  copyPage,
  movePage,
  pastePage,
  removePage,
  setCurrentIndex,
  setTitle,
} from './store'
import { Button, Input } from './ui'

const THUMB_WIDTH = 220
const THUMB_HEIGHT = THUMB_WIDTH * (9 / 16)
const THUMB_SCALE = THUMB_WIDTH / 1920

type RowProps = {
  index: number
  pageId: string
  page: PageData
  filename: string
  isActive: boolean
  templates: TemplateMap
}

const PageRow = memo(function PageRow({
  index,
  pageId,
  page,
  filename,
  isActive,
  templates,
}: RowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const overIndex = useValue($overIndex)
  const dragIndex = useValue($dragIndex)
  const total = useValue($pageIds).length
  const isOver = overIndex === index && dragIndex !== null && dragIndex !== index

  useEffect(() => {
    if (!isActive || !ref.current) return
    const active = document.activeElement as HTMLElement | null
    if (active?.dataset.pageRow === 'true' && active !== ref.current) {
      ref.current.focus()
    }
  }, [isActive])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      removePage(index)
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      copyPage(index)
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault()
      pastePage(index)
    }
  }

  return (
    <div className="px-3">
      {isOver && dragIndex! > index && <DropIndicator />}
      <div
        ref={ref}
        data-page-row="true"
        tabIndex={0}
        draggable
        onClick={(e) => {
          setCurrentIndex(index)
          e.currentTarget.focus()
        }}
        onFocus={() => setCurrentIndex(index)}
        onKeyDown={onKeyDown}
        onDragStart={(e) => {
          $dragIndex.set(index)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(index))
        }}
        onDragOver={(e) => {
          if ($dragIndex.get() === null) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if ($overIndex.get() !== index) $overIndex.set(index)
        }}
        onDrop={(e) => {
          e.preventDefault()
          const from = $dragIndex.get()
          if (from !== null && from !== index) movePage(from, index)
          $dragIndex.set(null)
          $overIndex.set(null)
        }}
        onDragEnd={() => {
          $dragIndex.set(null)
          $overIndex.set(null)
        }}
        className={`grid rounded-md grid-cols-[24px_1fr] items-center gap-2 py-1.5 outline-none cursor-pointer group ${
          isActive ? 'bg-accent-secondary' : ''
        }`}
      >
        <span
          className={`text-mono-xs tabular-nums text-right ${
            isActive ? 'text-default' : 'text-quaternary'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div
          title={filename.replace(/\.md$/, '')}
          className={`relative bg-default rounded overflow-hidden border border-default transition-shadow ${
            isActive
              ? 'group-focus:ring-accent-secondary group-focus:ring-2'
              : 'ring-transparent group-hover:ring-2 group-hover:ring-default group-focus:ring-secondary'
          }`}
          style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
        >
          <div className="pointer-events-none">
            <Page
              data={page}
              scale={THUMB_SCALE}
              mode="thumbnail"
              templates={templates}
              pageNumber={null}
              pageInfo={{ number: index + 1, total }}
            />
          </div>
          <PagePresenceDots pageId={pageId} />
        </div>
      </div>
      {isOver && dragIndex! < index && <DropIndicator />}
    </div>
  )
})

function DropIndicator() {
  return <div className="ml-[32px] h-0.5 bg-accent-secondary rounded my-1" />
}

function Header() {
  const title = useValue($title)
  const templates = useValue($templates)
  const templateNames = Object.keys(templates).sort()

  return (
    <div className="sticky top-0 bg-raise z-10 border-b border-default">
      <div className="px-3 pt-3 pb-2 flex items-center gap-1">
        <Input
          variant="ghost"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled deck"
          className="flex-1 min-w-0 -mx-1"
        />
        <button
          type="button"
          onClick={openDeckSelect}
          title="Switch deck"
          aria-label="Switch deck"
          className="shrink-0 p-1 rounded text-quaternary hover:text-default hover:bg-hover"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 4.5L6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="px-3 pb-3 flex gap-1">
        <Button
          onClick={() =>
            addPage(templateNames.includes('Text') ? 'Text' : templateNames[0] ?? 'Text')
          }
          className="flex-1"
        >
          New slide
        </Button>
      </div>
    </div>
  )
}

export default function PageList() {
  const pages = useValue('pages', () => $deck.get().pages, [])
  const pageIds = useValue($pageIds)
  const filenames = useValue($filenames)
  const currentIndex = useValue($currentIndex)
  const templates = useValue($templates)

  return (
    <>
      <Header />
      <div className="py-2">
        {pages.map((page, i) => (
          <PageRow
            key={pageIds[i] ?? i}
            index={i}
            pageId={pageIds[i] ?? ''}
            page={page}
            filename={filenames[i] ?? ''}
            isActive={i === currentIndex}
            templates={templates}
          />
        ))}
      </div>
    </>
  )
}
