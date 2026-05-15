import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import EditShell from './edit/EditShell'
import { startPersist } from './edit/persist'
import {
  $currentIndex,
  $deck,
  $filenames,
  initializeStore,
} from './edit/store'
import Page from './Page'
import type { TemplateMap, TemplateModule } from './Page'
import { useKey } from './hooks/use-key'
import * as Basic from './templates/Basic'
import * as Cover from './templates/Cover'
import * as FullPageDiagram from './templates/FullPageDiagram'
import * as FullPageImage from './templates/FullPageImage'
import * as HalfPage from './templates/HalfPage'
import * as TitleMultiColumn from './templates/TitleMultiColumn'

const builtInTemplates: TemplateMap = {
  Basic: Basic as TemplateModule,
  Cover: Cover as TemplateModule,
  FullPageDiagram: FullPageDiagram as TemplateModule,
  FullPageImage: FullPageImage as TemplateModule,
  HalfPage: HalfPage as TemplateModule,
  TitleMultiColumn: TitleMultiColumn as TemplateModule,
}

export const Schema = z.object({
  pages: z.any().array(),
})

type Content = {
  pages: any[]
  config?: { page_numbers?: boolean }
}

type Props = {
  content: Content
  filenames?: string[]
  customTemplates?: TemplateMap
}

const EDIT_SIDEBAR_WIDTH = 260 + 340

export default function App({ content, filenames = [], customTemplates = {} }: Props) {
  const templates = useMemo(
    () => ({ ...builtInTemplates, ...customTemplates }),
    [customTemplates],
  )

  const isPdf = useMemo(() => {
    const params = new URL(document.location.toString()).searchParams
    return params.get('pdf') !== null
  }, [])

  const isEdit = useMemo(() => {
    const params = new URL(document.location.toString()).searchParams
    return params.get('edit') !== null
  }, [])

  if (isEdit) initializeStore(content, filenames, templates)

  return isEdit ? (
    <EditView templates={templates} />
  ) : (
    <PresentView content={content} templates={templates} isPdf={isPdf} />
  )
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
    <div className="absolute bottom-[40px] right-[40px] opacity-40 text-xs">
      {n} / {content.pages.length}
    </div>
  )

  return (
    <div
      className={`w-full h-full relative ${
        isFullscreen ? 'bg-neutral-900' : 'bg-[#333]'
      }`}
    >
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

function EditView({ templates }: { templates: TemplateMap }) {
  const deck = useValue($deck)
  const currentIndex = useValue($currentIndex)
  const [scale, setScale] = useState(1.0)

  useEffect(() => {
    startPersist()
  }, [])

  useEffect(() => {
    function checkScale() {
      const stageWidth = window.innerWidth - EDIT_SIDEBAR_WIDTH
      const widthScale = stageWidth / 1920
      const heightScale = window.innerHeight / 1080
      setScale((widthScale < heightScale ? widthScale : heightScale) * 0.9)
    }
    checkScale()
    addEventListener('resize', checkScale)
    return () => removeEventListener('resize', checkScale)
  }, [])

  const prevPage = () => {
    const i = $currentIndex.get()
    if (i > 0) $currentIndex.set(i - 1)
  }
  const nextPage = () => {
    const i = $currentIndex.get()
    if (i < $deck.get().pages.length - 1) $currentIndex.set(i + 1)
  }
  useKey('left', prevPage)
  useKey('right', nextPage)
  useKey('mod+up', prevPage)
  useKey('mod+down', nextPage)

  const showPageNumbers = !!deck.config?.page_numbers
  const data = deck.pages[currentIndex]
  const total = deck.pages.length

  return (
    <EditShell>
      <div className="w-full h-full relative bg-[#333]">
        {data ? (
          <Page
            key={`${currentIndex}-${$filenames.get()[currentIndex] ?? ''}`}
            data={data}
            scale={scale}
            templates={templates}
            pageNumber={
              showPageNumbers ? (
                <div className="absolute bottom-[40px] right-[40px] opacity-40 text-xs">
                  {currentIndex + 1} / {total}
                </div>
              ) : null
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
            No pages — click “add page” in the sidebar.
          </div>
        )}
      </div>
    </EditShell>
  )
}
