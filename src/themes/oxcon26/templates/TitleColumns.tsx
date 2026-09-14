import {
  DeckText,
  HeaderBand,
  Markdown,
  Slide,
  SlideImage,
  colsW,
  gridX,
  gridY,
  imageField,
  stageGrid,
  toneVariant,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
  columns: z.array(z.string()).describe('text columns along the bottom left, usually two'),
  image: imageField().optional(),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const grid = stageGrid
  // Text columns share the 8 layout columns left of the image.
  const span = Math.min(4, Math.floor(8 / Math.max(data.columns.length, 1)))

  return (
    <Slide tone={data.variant ?? 'light'}>
      <HeaderBand />
      <DeckText style="display-sm" row={5} width={colsW(6)} className="deck-strong" as="h1">
        <Markdown content={data.title} field="title" />
      </DeckText>
      {data.image && (
        <SlideImage
          value={data.image}
          field="image"
          className="absolute object-cover"
          style={{
            left: gridX(grid, { col: 8, row: 0 }),
            top: gridY(grid, { row: 2 }),
            width: colsW(4),
            height: gridY(grid, { row: -1 }) - gridY(grid, { row: 2 }),
          }}
        />
      )}
      {data.columns.map((col, i) => (
        <DeckText
          key={i}
          style="text-sm"
          col={i * span}
          row={13}
          anchor="top"
          width={colsW(span)}
          className="deck-muted pr-(--grid-cell-w)"
        >
          <Markdown content={col} field="columns" fieldIndex={i} />
        </DeckText>
      ))}
    </Slide>
  )
}
