import hljs from 'highlight.js'
import { marked } from 'marked'
import { useEffect, useRef } from 'react'

export const Markdown = ({ content }: { content: string }) => {
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wrapper || !wrapper.current) return

    const elements = wrapper.current.querySelectorAll('pre code')

    if (elements) {
      elements.forEach((el) => {
        hljs.highlightElement(el as HTMLElement)
      })
    }
  }, [])

  return <div ref={wrapper} dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
}
