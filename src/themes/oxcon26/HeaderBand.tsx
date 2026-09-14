import type { GridResult } from '@oxide/design-system/grid'
import { useContext } from 'react'

import { PageInfoContext } from '../../stage'
import { gridX, place, stageGrid } from './grid'

/**
 * The mono header band: a label at the left margin and the slide number
 * (from PageInfoContext, override with `right`) at the right, both seated on
 * the same half-row baseline in deck-mono-sm.
 */
export function HeaderBand({
  left = 'OXCON_26',
  right,
  grid = stageGrid,
  className = '',
}: {
  left?: string
  /** Right slot; defaults to the slide number. */
  right?: string
  grid?: GridResult
  className?: string
}) {
  const pageInfo = useContext(PageInfoContext)
  const rightText = right ?? (pageInfo ? String(pageInfo.number) : null)

  // Color comes from .oxcon-header (tone-aware via .oxcon-light, styles.css).
  // Both slots share the row-1.5 baseline — mono-sm runs on half rows.
  return (
    <div className={`deck-mono-sm oxcon-header pointer-events-none ${className}`}>
      <span className="absolute" style={place(grid, { col: 0, row: 1.5 })}>
        {left}
      </span>
      {rightText && (
        <span
          className="absolute"
          style={{
            ...place(grid, { col: 0, row: 1.5 }),
            left: undefined,
            right: gridX(grid, { col: 0, row: 0 }),
          }}
        >
          {rightText}
        </span>
      )}
    </div>
  )
}
