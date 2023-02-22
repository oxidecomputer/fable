import hljs from 'highlight.js'
import { marked } from 'marked'
import { useEffect } from 'react'

export const Markdown = ({ content }: { content: string }) => {
  useEffect(() => {
    hljs.highlightAll()
  }, [])

  return <div dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
}
