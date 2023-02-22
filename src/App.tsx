import { useEffect, useState } from 'react'
import { z } from 'zod'

import Page from './Page'
import data from './content/index.toml'
import { useKey } from './hooks/use-key'
import './styles/index.css'

export const Schema = z.object({
  pages: z.any().array(),
})

Schema.parse(data)

function App() {
  let [isFullscreen, setIsFullscreen] = useState(false)
  let [scale, setScale] = useState(1.0)
  let [currentPage, setCurrentPage] = useState(0)

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    } else {
      setCurrentPage(data.pages.length - 1)
    }
  }

  const nextPage = () => {
    if (currentPage === data.pages.length - 1) {
      setCurrentPage(0)
    } else {
      setCurrentPage(currentPage + 1)
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

    addEventListener('fullscreenchange', onFullscreenChange)
    addEventListener('resize', checkScale)
  }, [])

  if (data && data.pages) {
    return (
      <div className="w-full h-full relative">
        <Page
          key={currentPage}
          data={data.pages[currentPage]}
          scale={scale * (isFullscreen ? 1.0 : 0.9)}
        />
      </div>
    )
  }

  return null
}

export default App
