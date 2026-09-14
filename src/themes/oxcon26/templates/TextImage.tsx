import {
  DeckText,
  HeaderBand,
  Markdown,
  STAGE_HEIGHT,
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
  text: z.string(),
  image: imageField(),
  footnotes: z
    .array(z.string())
    .optional()
    .describe('numbered footnotes, bottom-left of the text half'),
  flip: z.boolean().optional().describe('true puts the image on the left'),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const grid = stageGrid
  const textCol = data.flip ? 6 : 0
  const imageCol = data.flip ? 0 : 6

  return (
    <Slide tone={data.variant ?? 'light'}>
      <HeaderBand />
      <SlideImage
        value={data.image}
        field="image"
        className="absolute object-cover"
        style={{
          left: gridX(grid, { col: imageCol, row: 0 }),
          top: gridY(grid, { row: 2 }),
          width: colsW(6),
          height: gridY(grid, { row: -1 }) - gridY(grid, { row: 2 }),
        }}
      />
      <DeckText
        style="text-lg"
        col={textCol}
        row={4}
        width={colsW(6)}
        className="deck-muted pr-[calc(var(--grid-cell-w)*2)]"
      >
        <Markdown content={data.text} field="text" />
      </DeckText>
      {data.footnotes && (
        <div
          className="absolute flex flex-col"
          style={{
            left: gridX(grid, { col: textCol, row: 0 }),
            bottom: STAGE_HEIGHT - gridY(grid, { row: -1 }),
            width: colsW(5),
            gap: grid.cellH / 2,
          }}
        >
          {data.footnotes.map((note, i) => (
            <div key={i} className="deck-text-xs flex deck-muted">
              <span className="shrink-0 deck-faint" style={{ width: grid.u * 2 }}>
                {i + 1}
              </span>
              <Markdown content={note} field="footnotes" fieldIndex={i} />
            </div>
          ))}
        </div>
      )}
    </Slide>
  )
}
