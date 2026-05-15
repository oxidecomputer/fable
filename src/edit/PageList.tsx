import { useValue } from '@tldraw/state-react'

import Page from '../Page'
import {
  $currentIndex,
  $deck,
  $filenames,
  $templates,
  addPage,
  movePage,
  removePage,
} from './store'

const THUMB_WIDTH = 240
const THUMB_SCALE = THUMB_WIDTH / 1920

export default function PageList() {
  const pages = useValue('pages', () => $deck.get().pages, [])
  const filenames = useValue($filenames)
  const currentIndex = useValue($currentIndex)
  const templates = useValue($templates)
  const templateNames = Object.keys(templates).sort()

  return (
    <div className="border-b border-neutral-700">
      <div className="px-3 py-2 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wide text-neutral-400">Pages</h2>
        <button
          type="button"
          onClick={() => addPage(templateNames[0] ?? 'Basic')}
          className="text-xs text-indigo-300 hover:text-indigo-100"
        >
          + add page
        </button>
      </div>
      <div className="text-sm">
        {pages.map((page, i) => {
          const filename = filenames[i] ?? '—'
          const isActive = i === currentIndex
          return (
            <div
              key={filename}
              onClick={() => $currentIndex.set(i)}
              className={`group cursor-pointer flex items-start gap-1 px-2 py-2 border-l-2 ${
                isActive
                  ? 'bg-neutral-700/50 border-indigo-400'
                  : 'border-transparent hover:bg-neutral-700/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="relative bg-neutral-900 rounded overflow-hidden border border-neutral-700 pointer-events-none"
                  style={{ width: THUMB_WIDTH, height: THUMB_WIDTH * (9 / 16) }}
                >
                  <Page
                    data={page}
                    scale={THUMB_SCALE}
                    templates={templates}
                    pageNumber={null}
                  />
                </div>
                <div className="flex items-baseline gap-2 text-xs text-neutral-500 mt-1 truncate">
                  <span className="text-neutral-400 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{filename.replace(/\.md$/, '')}</span>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex flex-col text-neutral-400">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    movePage(i, i - 1)
                  }}
                  disabled={i === 0}
                  className="leading-none px-1 disabled:opacity-30 hover:text-neutral-100"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    movePage(i, i + 1)
                  }}
                  disabled={i === pages.length - 1}
                  className="leading-none px-1 disabled:opacity-30 hover:text-neutral-100"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removePage(i)
                }}
                className="opacity-0 group-hover:opacity-100 px-1 text-neutral-400 hover:text-red-400"
                title="Delete page"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
