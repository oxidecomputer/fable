import { type GridResult, computeGrid } from '@oxide/design-system/grid'
import type { CSSProperties } from 'react'

/**
 * The OXCON dual grid, fixed to the 1920×1080 stage: 12 layout columns with
 * 3 cells of margin and 1-cell gutters over a 77-column ASCII cell grid.
 * cellAspect 2 snaps (within the 5% tolerance) to exactly 22 rows filling the
 * stage height. Slides never resize — the grid is a constant.
 */
export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export const stageGrid: GridResult = computeGrid({
  mode: 'manual',
  columns: 12,
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
  marginCells: 3,
  gutterCells: 1,
  targetCellColumns: 77,
  cellAspect: 2,
  snapRows: true,
  snapTolerancePx: 0.5,
  aspectTolerancePct: 5,
})

const COLUMNS = 12

export type GridPlace = {
  /** Layout column 0–11 (content space only). Negative counts from the right. */
  col?: number
  /** ASCII-cell offset, added after `col` (or from the space origin if no col). */
  cell?: number
  /** Baseline row in cells. Negative counts from the bottom (-1 = last row). */
  row: number
  /** 'content' (default): origin at the margin. 'page': origin at the stage's cell (0,0). */
  space?: 'content' | 'page'
}

export function gridX(
  grid: GridResult,
  { col, cell = 0, space = 'content' }: GridPlace,
): number {
  const origin = space === 'page' ? grid.hRemainder / 2 : grid.effectiveMargin
  const colIndex = col === undefined ? 0 : col < 0 ? COLUMNS + col : col
  const colX = col === undefined ? 0 : colIndex * (grid.columnWidth + grid.gutterWidth)
  return origin + colX + cell * grid.u
}

export function gridY(grid: GridResult, { row }: GridPlace): number {
  const rowIndex = row < 0 ? grid.rows + row : row
  return grid.rowOffset + rowIndex * grid.cellH
}

/** Width of n layout columns including internal gutters. */
export const colsW = (n: number, grid: GridResult = stageGrid) =>
  n * (grid.columnWidth + grid.gutterWidth) - grid.gutterWidth

// The design system's optical tracking curve, from styles/main.css.
export const trackingEm = (fontSize: number) => 0.981 / fontSize - 0.0401

// GT America Mono advances uniformly 620/1000 (which is what lets the dual
// grid treat every glyph as one cell), so ASCII layers can be sized
// analytically like capsize text instead of probing the DOM. A stale size is
// impossible: if the fallback paints first, the swap to GT Mono lands on the
// grid by construction.
const GT_MONO_ADVANCE = 0.62

/** Font size at which one GT Mono character advances exactly `cells` × u. */
export function monoFontSize(grid: GridResult, cells = 1): number {
  return (cells * grid.u) / GT_MONO_ADVANCE
}

/**
 * Absolute-position style seating a capsize-trimmed baseline on the given
 * row. Capsize trims each block to run from cap top to baseline, so
 * translateY(-100%) against `top` puts the baseline exactly on the row.
 */
export function place(grid: GridResult, p: GridPlace): CSSProperties {
  return {
    position: 'absolute',
    left: gridX(grid, p),
    top: gridY(grid, p),
    transform: 'translateY(-100%)',
  }
}
