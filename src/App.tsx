import { useEffect, useState } from 'react'
import { z } from 'zod'

import Page from './Page'
import { useKey } from './hooks/use-key'
import './styles/index.css'

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
    if (newPage === 0) {
      window.location.href = ''
    } else {
      window.location.href = `#${newPage + 1}`
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

    function checkContent() {
      if (window.ENV && window.ENV.content) {
        const content = window.ENV.content

        setData(content)
        Schema.parse(content)
      }
    }

    checkContent()
    checkScale()

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

      if (page < data.pages.length) {
        setCurrentPage(page - 1)
      }
    }

    getPage()
  }, [data])

  const pageNumber = () => (
    <div className="absolute bottom-[40px] right-[40px] opacity-40 text-2xl">
      {currentPage + 1} / {data.pages.length}
    </div>
  )

  if (data && data.pages) {
    return (
      <div
        className={`w-full h-full relative ${isFullscreen ? 'bg-default' : 'bg-[#333]'}`}
      >
        <Page
          key={currentPage}
          data={data.pages[currentPage]}
          scale={scale * (isFullscreen ? 1.0 : 0.9)}
          pageNumber={data.config && data.config.page_numbers ? pageNumber() : null}
        />
      </div>
    )
  }

  return null
}

export default App
