import hljs from 'highlight.js'
import { marked } from 'marked'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export const Markdown = ({
  content,
  className = '',
}: {
  content: string
  className?: string
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
      className={`markdown ${className}`}
      dangerouslySetInnerHTML={{
        __html: marked.parse(content),
      }}
    />
  )
}

interface FitTextProps {
  children: ReactNode
  className?: string
}

export const FitText = ({ children, className = '' }: FitTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState<number>()
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const fitTextToContainer = () => {
      if (containerRef.current && textRef.current) {
        if (!fontSize) {
          const size = parseFloat(
            window.getComputedStyle(textRef.current, null).getPropertyValue('font-size') ||
              '120',
          )

          setFontSize(size)
          return
        }

        const containerHeight = containerRef.current.offsetHeight
        const textHeight = textRef.current.offsetHeight

        if (textHeight > containerHeight) {
          setFontSize(fontSize * 0.9)
        } else {
          setVisible(true)
        }
      }
    }

    fitTextToContainer()
  }, [fontSize])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className} ${visible ? '' : 'invisible'}`}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div ref={textRef} className="absolute top-0 left-0 right-0">
        {children}
      </div>
    </div>
  )
}
