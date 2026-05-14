import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

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
  customTemplates?: TemplateMap
}

export default function App({ content, customTemplates = {} }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scale, setScale] = useState(1.0)
  const [currentPage, setCurrentPage] = useState(0)

  const templates = useMemo(
    () => ({ ...builtInTemplates, ...customTemplates }),
    [customTemplates],
  )

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

  const isPdf = useMemo(() => {
    const params = new URL(document.location.toString()).searchParams
    return params.get('pdf')
  }, [])

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

  const pageNumber = (n: number) => (
    <div className="absolute bottom-[40px] right-[40px] opacity-40 text-xs">
      {n} / {content.pages.length}
    </div>
  )

  const showPageNumbers = !!content.config?.page_numbers

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
