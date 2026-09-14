import { FONT_METRICS, useCapsize } from '@oxide/design-system/capsize'
import type { GridResult } from '@oxide/design-system/grid'
import type { CSSProperties, ReactNode } from 'react'

import { gridX, gridY, place, stageGrid } from './grid'

/**
 * The Suisse ramp (the deck-* classes) with line heights in grid rows —
 * the same numbers styles.css derives from --grid-cell.
 */
const RAMP = {
  'text-xs': { fontSize: 20, rows: 1 / 2 },
  'text-sm': { fontSize: 28, rows: 2 / 3 },
  'text-md': { fontSize: 40, rows: 1 },
  'text-lg': { fontSize: 54, rows: 4 / 3 },
  'display-sm': { fontSize: 90, rows: 2 },
  'display-md': { fontSize: 135, rows: 3 },
  'display-lg': { fontSize: 245, rows: 5 },
} as const

export type DeckTextStyle = keyof typeof RAMP

/**
 * A ramp-styled text block seated on the dual grid: capsize-trimmed so its
 * edges are the cap top and the baseline, placed at a layout column and cell
 * row. `anchor: 'baseline'` (default) seats the last line's baseline on the
 * row; `'first-baseline'` seats the first line's baseline (stable as the
 * text wraps); `'top'` seats the first line's cap top. Width defaults to
 * running from the column to the content area's right edge.
 */
export function DeckText({
  style,
  col = 0,
  cell,
  row,
  anchor = 'first-baseline',
  width,
  className = '',
  grid = stageGrid,
  as: Tag = 'div',
  children,
}: {
  /** Ramp style name (the deck-* class without the prefix). */
  style: DeckTextStyle
  col?: number
  cell?: number
  row: number
  anchor?: 'baseline' | 'first-baseline' | 'top'
  width?: number
  className?: string
  grid?: GridResult
  as?: 'div' | 'h1' | 'h2' | 'p'
  children: ReactNode
}) {
  const { fontSize, rows } = RAMP[style]
  const cap = useCapsize({
    fontFamily: 'suisse-intl',
    fontSize,
    lineHeight: rows * grid.cellH,
  })

  // The capsize trim puts the block's top edge at the first line's cap top,
  // so the first baseline sits capHeight below it.
  const metrics = FONT_METRICS['suisse-intl']
  const capHeight = fontSize * (metrics.capHeight / metrics.unitsPerEm)

  const left = gridX(grid, { col, cell, row: 0 })
  const pos: CSSProperties =
    anchor === 'baseline'
      ? place(grid, { col, cell, row })
      : {
          position: 'absolute',
          left,
          top: gridY(grid, { row }) - (anchor === 'first-baseline' ? capHeight : 0),
        }

  return (
    <Tag
      className={`deck-${style} ${cap.className} ${className}`}
      style={{
        ...cap.styles,
        ...pos,
        width: width ?? grid.effectiveMargin + grid.contentWidth - left,
      }}
    >
      {children}
    </Tag>
  )
}
