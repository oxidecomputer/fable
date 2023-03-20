import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import '../styles/dist/index.css'
import Page from './Page'
import { useKey } from './hooks/use-key'

export const Schema = z.object({
  pages: z.any().array(),
})

function App() {
  const [data, setData] = useState<any>()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scale, setScale] = useState(1.0)
  const [currentPage, setCurrentPage] = useState(0)

  const prevPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1
      updateUrl(newPage)
      setCurrentPage(newPage)
    }
  }

  const nextPage = () => {
    if (currentPage < data.pages.length - 1) {
      const newPage = currentPage + 1
      updateUrl(newPage)
      setCurrentPage(newPage)
    }
  }

  const updateUrl = (newPage: number) => {
    window.location.href = `#${newPage + 1}`
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

    function checkContent() {
      if (window.ENV && window.ENV.content) {
        const content = window.ENV.content

        setData(content)
        Schema.parse(content)
      }
    }

    checkContent()
    checkScale()

    if (isPdf) {
      document.body.classList.add('--pdf')
    }

    addEventListener('fullscreenchange', onFullscreenChange)
    addEventListener('resize', checkScale)
  }, [])

  useEffect(() => {
    if (!data || !data.pages) {
      return
    }

    function getPage() {
      const hash = window.location.hash.replace('#', '')

      if (!hash) return

      const page = parseInt(hash)

      if (page <= data.pages.length) {
        setCurrentPage(page - 1)
      }
    }

    getPage()
  }, [data])

  const pageNumber = (currentPage: number) => (
    <div className="absolute bottom-[40px] right-[40px] opacity-40 text-2xl">
      {currentPage} / {data.pages.length}
    </div>
  )

  if (data && data.pages) {
    return (
      <div
        className={`w-full h-full relative ${isFullscreen ? 'bg-default' : 'bg-[#333]'}`}
      >
        {isPdf ? (
          [...Array(data.pages.length)].map((_e, i) => (
            <Page
              key={i}
              data={data.pages[i]}
              scale={1}
              pageNumber={
                data.config && data.config.page_numbers ? pageNumber(i + 1) : null
              }
            />
          ))
        ) : (
          <Page
            key={currentPage}
            data={data.pages[currentPage]}
            scale={scale * (isFullscreen ? 1.0 : 0.9)}
            pageNumber={
              data.config && data.config.page_numbers ? pageNumber(currentPage + 1) : null
            }
          />
        )}
      </div>
    )
  }

  return null
}

export default App
