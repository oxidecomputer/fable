import { useMyPresence, useOthers } from '@liveblocks/react'
import { useValue } from '@tldraw/state-react'
import { useEffect, useRef } from 'react'

import { $currentPageId } from '../store'

/**
 * Live cursors over the edit stage. Cursor positions are stored in presence
 * as 1920×1080 stage coordinates so every client can render them at its own
 * scale. Renders as a pointer-events-none overlay; mouse tracking attaches
 * to the parent element.
 */
export default function StageCursors({ scale }: { scale: number }) {
  const [, updateMyPresence] = useMyPresence()
  const currentPageId = useValue($currentPageId)
  const others = useOthers((others) =>
    others.filter((o) => o.presence.cursor !== null && o.presence.pageId !== null),
  )
  const ref = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  useEffect(() => {
    const overlay = ref.current
    const container = overlay?.parentElement
    if (!container) return

    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = container.getBoundingClientRect()
        const s = scaleRef.current
        const x = (e.clientX - rect.left - (rect.width - 1920 * s) / 2) / s
        const y = (e.clientY - rect.top - (rect.height - 1080 * s) / 2) / s
        if (x < 0 || y < 0 || x > 1920 || y > 1080) {
          updateMyPresence({ cursor: null })
        } else {
          updateMyPresence({ cursor: { x: Math.round(x), y: Math.round(y) } })
        }
      })
    }
    const onLeave = () => updateMyPresence({ cursor: null })

    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
      updateMyPresence({ cursor: null })
    }
  }, [updateMyPresence])

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none overflow-hidden">
      {others.map((other) => {
        if (other.presence.pageId !== currentPageId || !other.presence.cursor) return null
        const { x, y } = other.presence.cursor
        const color = other.info?.color ?? '#9DAFFA'
        return (
          <div
            key={other.connectionId}
            className="absolute"
            style={{
              left: `calc(50% + ${(x - 960) * scale}px)`,
              top: `calc(50% + ${(y - 540) * scale}px)`,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M1 1l5.5 13 1.8-5.7L14 6.5z" fill={color} stroke="#080F11" />
            </svg>
            <span
              className="ml-3 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
              style={{ backgroundColor: color, color: '#080F11' }}
            >
              {other.info?.name ?? 'Anonymous'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
