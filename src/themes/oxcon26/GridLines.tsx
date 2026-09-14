import { type GridResult, gridLineSegments } from '@oxide/design-system/grid'

import { STAGE_HEIGHT, STAGE_WIDTH, gridY, stageGrid } from './grid'

export type GridLineSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  horizontal: boolean
}

/**
 * Cell-grid hairlines as a background texture, ported from the OXCON display.
 * `cull` decides which segments to drop; the default keeps the display's look
 * (vertical lines only in the outer thirds of the stage, horizontal lines only
 * in the bottom third, cut at a whole cell row). Pass `() => false` for the
 * full grid. Same segment source and edge culling as the site's debug overlay.
 */
export function GridLines({
  grid = stageGrid,
  cull,
  opacity = 0.5,
}: {
  grid?: GridResult
  /** Return true to drop a segment. */
  cull?: (seg: GridLineSegment) => boolean
  opacity?: number
}) {
  const cutoff = gridY(grid, { row: Math.ceil((grid.rows * 2) / 3) })
  const defaultCull = ({ x1, y1, horizontal }: GridLineSegment) =>
    horizontal ? y1 < cutoff : x1 > STAGE_WIDTH / 3 && x1 < (STAGE_WIDTH * 2) / 3
  const drop = cull ?? defaultCull
  const segments = gridLineSegments(grid, STAGE_WIDTH, STAGE_HEIGHT, {
    edgeCull: true,
    edgeCullPct: 20,
  }).filter(([x1, y1, x2, y2]) => !drop({ x1, y1, x2, y2, horizontal: y1 === y2 }))

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      aria-hidden
    >
      {segments.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--color-neutral-600)"
          strokeOpacity={opacity}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
