import {
  DeckText,
  HeaderBand,
  Markdown,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  Slide,
  colsW,
  gridX,
  gridY,
  stageGrid,
  toneVariant,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  stat: z.string(),
  text: z.string(),
  percent: z.number().describe('highlighted pie slice, 0–100'),
  legend: z
    .array(z.string())
    .optional()
    .describe('legend entries under the pie; bold the lead phrase'),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const grid = stageGrid

  // Pie flush with the right margin, top on row 4, 12 rows tall.
  const r = grid.cellH * 6
  const cx = grid.effectiveMargin + grid.contentWidth - r
  const cy = gridY(grid, { row: 4 }) + r
  const a = (Math.min(Math.max(data.percent, 0), 99.99) / 100) * 2 * Math.PI
  const sx = cx + r * Math.sin(a)
  const sy = cy - r * Math.cos(a)

  return (
    <Slide tone={data.variant ?? 'dark'}>
      <HeaderBand />
      <DeckText style="display-lg" row={9} className="deck-accent" as="h1">
        <Markdown content={data.stat} field="stat" />
      </DeckText>
      <DeckText
        style="text-md"
        row={20}
        anchor="baseline"
        width={colsW(6)}
        className="deck-muted"
      >
        <Markdown content={data.text} field="text" />
      </DeckText>
      <svg
        className="pointer-events-none absolute inset-0"
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        aria-hidden
      >
        <circle cx={cx} cy={cy} r={r} fill="var(--deck-pie-track)" />
        <path
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${
            a > Math.PI ? 1 : 0
          } 1 ${sx} ${sy} Z`}
          fill="var(--deck-pie-fill)"
        />
      </svg>
      {data.legend?.map((entry, i) => (
        <div key={i}>
          <div
            className="absolute"
            style={{
              left: gridX(grid, { col: 8 + i * 2, row: 0 }) - grid.u,
              top: gridY(grid, { row: 4 }),
              width: 1,
              height: gridY(grid, { row: -1 }) - gridY(grid, { row: 4 }),
              background: 'var(--deck-hairline)',
            }}
          />
          <DeckText
            style="text-xs"
            col={8 + i * 2}
            row={-2}
            width={colsW(2)}
            className="deck-muted"
          >
            <Markdown content={entry} field="legend" fieldIndex={i} />
          </DeckText>
        </div>
      ))}
    </Slide>
  )
}
