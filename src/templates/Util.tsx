import hljs from 'highlight.js'
import { marked } from 'marked'
import { useEffect, useRef } from 'react'

export const Markdown = ({
  content,
  className,
  inline = false,
}: {
  content: string
  className?: string
  inline?: boolean
}) => {
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

  return (
    <div
      ref={wrapper}
      className={className}
      dangerouslySetInnerHTML={{
        __html: inline ? marked.parseInline(content) : marked.parse(content),
      }}
    />
  )
}
