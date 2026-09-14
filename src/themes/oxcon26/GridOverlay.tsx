import { gridLineSegments } from '@oxide/design-system/grid'

import { STAGE_HEIGHT, STAGE_WIDTH, gridX, stageGrid } from './grid'

const COLUMNS = 12

/**
 * Debug rendering of the dual grid, ported from the OXCON display: the twelve
 * layout columns as translucent bands and the full ASCII cell grid as lines,
 * with lines near the stage edge culled. Drawn in fixed stage coordinates so
 * it scales with the slide. Rendered over the edit stage when the grid view
 * setting is on ("g").
 */
export function GridOverlay() {
  const grid = stageGrid
  const segments = gridLineSegments(grid, STAGE_WIDTH, STAGE_HEIGHT, {
    edgeCull: true,
    edgeCullPct: 20,
  })

  const columnXs = Array.from({ length: COLUMNS }, (_, i) =>
    gridX(grid, { col: i, row: 0 }),
  )

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-50"
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      aria-hidden
    >
      {columnXs.map((x) => (
        <rect
          key={x}
          x={x}
          y={0}
          width={grid.columnWidth}
          height={STAGE_HEIGHT}
          fill="var(--color-purple-800)"
          fillOpacity={0.3}
        />
      ))}
      <text
        x={grid.hRemainder / 2 + grid.N * grid.u}
        y={grid.rowOffset + grid.rows * grid.cellH}
        textAnchor="end"
        className="font-mono"
        fontSize={12}
        fill="var(--color-blue-800)"
      >
        {grid.N} × {grid.rows}
      </text>
      {segments.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--color-blue-800)"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
