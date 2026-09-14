import {
  DeckText,
  HeaderBand,
  Markdown,
  Slide,
  gridX,
  gridY,
  stageGrid,
  toneVariant,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  rows: z.array(z.object({ stat: z.string(), label: z.string() })),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const grid = stageGrid
  const n = Math.max(data.rows.length, 1)
  // Equal bands from row 3 to the last row, hairlines between them.
  const band = Math.floor((grid.rows - 3 - 1) / n)

  return (
    <Slide tone={data.variant ?? 'light'}>
      <HeaderBand />
      {data.rows.map((row, i) => (
        <div key={i}>
          <DeckText style="display-md" row={3 + (i + 1) * band - 1} className="deck-strong">
            <Markdown content={row.stat} field="rows.stat" fieldIndex={i} />
          </DeckText>
          <DeckText
            style="text-md"
            col={9}
            row={3 + (i + 1) * band - 1}
            anchor="baseline"
            className="deck-muted"
          >
            <Markdown content={row.label} field="rows.label" fieldIndex={i} />
          </DeckText>
          {i < data.rows.length - 1 && (
            <div
              className="absolute"
              style={{
                left: gridX(grid, { col: 0, row: 0 }),
                top: gridY(grid, { row: 3 + (i + 1) * band }),
                width: grid.contentWidth,
                height: 1,
                background: 'var(--deck-hairline)',
              }}
            />
          )}
        </div>
      ))}
    </Slide>
  )
}
