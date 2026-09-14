import { useEffect, useMemo, useRef } from 'react'

import { useStage } from '../../stage'
import { type ShaderParams, defaultShaderParams, startRenderer } from './heatmap-renderer'

/**
 * The OXCON heatmap shader as a slide background: a WebGL2 canvas filling the
 * 1920×1080 stage, behind whatever the template layers on top. Pass `params`
 * to override any of {@link defaultShaderParams} (colors, speed, dim cycle…).
 * Thumbnails render a single static frame instead of animating.
 */
export function ShaderBackground({ params }: { params?: Partial<ShaderParams> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const merged = useMemo(() => ({ ...defaultShaderParams, ...params }), [params])
  const { mode } = useStage()
  const animate = mode !== 'thumbnail'

  useEffect(() => startRenderer(ref.current!, merged, { animate }), [merged, animate])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
