import { useValue } from '@tldraw/state-react'
import { type KeyboardEvent, memo, useEffect, useRef } from 'react'

import Page, { type TemplateMap } from '../Page'
import {
  $currentIndex,
  $deck,
  $dragIndex,
  $filenames,
  $overIndex,
  $templates,
  $title,
  type PageData,
  addPage,
  movePage,
  removePage,
  setTitle,
} from './store'

const THUMB_WIDTH = 220
const THUMB_HEIGHT = THUMB_WIDTH * (9 / 16)
const THUMB_SCALE = THUMB_WIDTH / 1920

type RowProps = {
  index: number
  page: PageData
  filename: string
  isActive: boolean
  templates: TemplateMap
}

const PageRow = memo(function PageRow({
  index,
  page,
  filename,
  isActive,
  templates,
}: RowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const overIndex = useValue($overIndex)
  const dragIndex = useValue($dragIndex)
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
          $currentIndex.set(index)
          e.currentTarget.focus()
        }}
        onFocus={() => $currentIndex.set(index)}
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
          className={`relative bg-stage-900 rounded overflow-hidden border border-default transition-shadow ${
            isActive
              ? 'group-focus:ring-accent-secondary group-focus:ring-2'
              : 'ring-transparent group-hover:ring-2 group-hover:ring-default group-focus:ring-secondary'
          }`}
          style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
        >
          <div className="pointer-events-none">
            <Page data={page} scale={THUMB_SCALE} templates={templates} pageNumber={null} />
          </div>
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
      <div className="px-3 pt-3 pb-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled deck"
          className="w-full bg-transparent text-sans-sm font-semibold text-default placeholder:text-quaternary outline-none focus:bg-default rounded px-1 py-0.5 -mx-1"
        />
      </div>
      <div className="px-3 pb-3 flex gap-1">
        <button
          type="button"
          onClick={() => addPage(templateNames[0] ?? 'Basic')}
          className="flex-1 text-mono-xs text-default bg-default hover:bg-hover border border-default rounded px-2 py-1.5"
        >
          New slide
        </button>
      </div>
    </div>
  )
}

export default function PageList() {
  const pages = useValue('pages', () => $deck.get().pages, [])
  const filenames = useValue($filenames)
  const currentIndex = useValue($currentIndex)
  const templates = useValue($templates)

  return (
    <>
      <Header />
      <div className="py-2">
        {pages.map((page, i) => (
          <PageRow
            key={filenames[i] ?? i}
            index={i}
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
