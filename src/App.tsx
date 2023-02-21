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
  let [scale, setScale] = useState(0.5)
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

  useKey('left', prevPage)
  useKey('right', nextPage)

  // get ref size
  // scale to fit
  useEffect(() => {
    setScale((window.innerWidth / 1920) * 0.9)
  }, [])

  if (data && data.pages) {
    return (
      <div className="w-full h-full relative">
        <Page key={currentPage} data={data.pages[currentPage]} scale={scale} />
      </div>
    )
  }

  return null
}

export default App
