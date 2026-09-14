import { createAnimation } from '@oxide/ascii-shader'
import type { GridResult } from '@oxide/design-system/grid'
import { useEffect, useRef, useState } from 'react'

import { useStage } from '../../stage'
import { monoFontSize, stageGrid } from './grid'
import { type SilkscreenOptions, createSilkscreenProgram } from './silkscreen-program'

/**
 * Generative silkscreen micrographics behind a slide, drawn as real text by
 * the ascii-shader engine. Attached to the char grid but at half size: the
 * program runs at 2× the grid's cols × rows, with the font solved so one
 * character advances exactly u/2 and the line height is exactly cellH/2 — so
 * every 2×2 block of program cells lands on one background grid cell, and
 * motifs snapped to even program cells seat on grid-cell corners.
 */
export function Silkscreen({
  grid = stageGrid,
  opacity = 0.6,
  className = 'text-neutral-800',
  ...options
}: {
  grid?: GridResult
  /** Resting opacity once the program has booted (fades in from 0). */
  opacity?: number
  className?: string
} & SilkscreenOptions) {
  const ref = useRef<HTMLPreElement>(null)
  // Boot-gated fade: the layer waits on a font force-load plus engine boot and
  // would otherwise pop in a few frames after the rest of the slide.
  const [ready, setReady] = useState(false)
  const { cycleFrames, stamp } = options
  // Thumbnails skip the layer entirely: at rail size the micrographics are
  // sub-pixel noise, not worth a per-slide animation loop.
  const thumbnail = useStage().mode === 'thumbnail'

  useEffect(() => {
    if (thumbnail) return
    const el = ref.current!
    let anim: ReturnType<typeof createAnimation> | null = null
    let cancelled = false

    // GT America Mono must be force-loaded before boot: the engine measures
    // the face on mount, and `fonts.ready` alone doesn't guarantee anything
    // else has requested it. The font size is solved so one character spans
    // exactly half a cell.
    document.fonts.load("1em 'GT America Mono'").then(() => {
      if (cancelled) return
      el.style.fontSize = `${monoFontSize(grid, 0.5)}px`

      anim = createAnimation(createSilkscreenProgram({ cycleFrames, stamp }), {
        element: el,
        cols: grid.N * 2,
        rows: grid.rows * 2,
      })
      setReady(true)
    })

    return () => {
      cancelled = true
      anim?.dispose()
    }
  }, [grid, cycleFrames, stamp, thumbnail])

  if (thumbnail) return null

  return (
    <pre
      ref={ref}
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={{
        opacity: ready ? opacity : 0,
        transition: 'opacity 400ms cubic-bezier(0.215, 0.61, 0.355, 1)',
        // Page-space cell (0,0): the char grid's own origin, so the half-cells
        // tile the grid exactly.
        position: 'absolute',
        left: grid.hRemainder / 2,
        top: grid.rowOffset,
        width: grid.N * grid.u,
        height: grid.rows * grid.cellH,
        fontFamily: "'GT America Mono', monospace",
        lineHeight: `${grid.cellH / 2}px`,
        // Zero the design system's optical tracking or cells drift off grid.
        letterSpacing: 0,
      }}
    />
  )
}
