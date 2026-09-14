import { FONT_METRICS, useCapsize } from '@oxide/design-system/capsize'
import type { GridResult } from '@oxide/design-system/grid'
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

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
  'text-xl': { fontSize: 68, rows: 5 / 3 },
  'display-sm': { fontSize: 90, rows: 2 },
  'display-sm-md': { fontSize: 110, rows: 5 / 2 },
  'display-md': { fontSize: 135, rows: 3 },
  'display-md-lg': { fontSize: 180, rows: 4 },
  'display-lg': { fontSize: 245, rows: 5 },
} as const

export type DeckTextStyle = keyof typeof RAMP

// Smallest → largest, as declared above.
const RAMP_ORDER = Object.keys(RAMP) as DeckTextStyle[]

/**
 * A ramp-styled text block seated on the dual grid: capsize-trimmed so its
 * edges are the cap top and the baseline, placed at a layout column and cell
 * row. `anchor: 'baseline'` (default) seats the last line's baseline on the
 * row; `'first-baseline'` seats the first line's baseline (stable as the
 * text wraps); `'top'` seats the first line's cap top. Width defaults to
 * running from the column to the content area's right edge.
 *
 * `autofit` steps the block down the ramp (font size and leading together)
 * until it fits: by default within the space between the anchor row and the
 * content edge the text grows toward, or within an explicit budget —
 * `{ height }` in cell rows, `{ lines }` as a max wrapped-line count at the
 * fitted size. `style` stays the size for content that fits.
 */
export function DeckText({
  style,
  col = 0,
  cell,
  row,
  anchor = 'first-baseline',
  width,
  autofit,
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
  /** Step down the ramp until the block fits. `true` = fit the space between
   * the anchor row and the content edge; `{ height }` = max height in cell
   * rows, `{ lines }` = max wrapped lines (combinable). */
  autofit?: boolean | { height?: number; lines?: number }
  className?: string
  grid?: GridResult
  as?: 'div' | 'h1' | 'h2' | 'p'
  children: ReactNode
}) {
  const declaredIndex = RAMP_ORDER.indexOf(style)
  const ref = useRef<HTMLElement>(null)
  const lastText = useRef<string>()
  const [stepDown, setStepDown] = useState(0)
  const fitted = autofit ? RAMP_ORDER[Math.max(0, declaredIndex - stepDown)] : style

  const { fontSize, rows } = RAMP[fitted]
  const lineHeight = rows * grid.cellH
  const cap = useCapsize({ fontFamily: 'suisse-intl', fontSize, lineHeight })

  // The capsize trim puts the block's top edge at the first line's cap top,
  // so the first baseline sits capHeight below it.
  const metrics = FONT_METRICS['suisse-intl']
  const capHeight = fontSize * (metrics.capHeight / metrics.unitsPerEm)

  // With `baseline` the block ends on the row and grows upward; the other
  // anchors pin the first line and grow downward. The default height budget
  // runs to the content edge in the growth direction.
  const budget = typeof autofit === 'object' ? autofit : {}
  const maxHeight =
    budget.height !== undefined
      ? budget.height * grid.cellH
      : anchor === 'baseline'
      ? gridY(grid, { row }) - grid.rowOffset
      : grid.rowOffset + grid.rows * grid.cellH - gridY(grid, { row })
  const maxLines = budget.lines

  // Converges before paint: layout-effect state updates flush synchronously,
  // so intermediate steps never flash. A content change resets to the
  // declared style so the block grows back when text shrinks.
  useLayoutEffect(() => {
    const el = ref.current
    if (!autofit || !el) return
    const text = el.textContent ?? ''
    if (lastText.current !== text) {
      lastText.current = text
      if (stepDown !== 0) {
        setStepDown(0)
        return
      }
    }
    // The trimmed block runs cap top → last baseline: (n - 1) lines + a cap.
    const lineCount = Math.round((el.offsetHeight - capHeight) / lineHeight) + 1
    const overflows =
      el.offsetHeight > maxHeight + 0.5 ||
      (maxLines !== undefined && lineCount > maxLines) ||
      el.scrollWidth > el.clientWidth + 0.5
    if (overflows && declaredIndex - stepDown > 0) setStepDown(stepDown + 1)
  })

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
      ref={ref as Ref<never>}
      className={`deck-${fitted} ${cap.className} ${className}`}
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
