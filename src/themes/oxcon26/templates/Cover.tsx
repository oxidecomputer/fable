import {
  DeckText,
  Markdown,
  ShaderBackground,
  Slide,
  gridX,
  gridY,
  oxconAssets,
  stageGrid,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
})

type Schema = z.infer<typeof Schema>

// Layout in grid units: wordmark and title sit at column 2, inside the dark
// center panel of the full-height 0X reverse; the title's (last) baseline
// three rows up from the bottom, the wordmark's top on row 3.
export const Template = ({ data }: { data: Schema }) => {
  const grid = stageGrid

  return (
    <Slide>
      <ShaderBackground />
      {/* Full-height dark reverse of the 0X mark: the bars are cut out, so
          the shader's metallic texture shows only through the mark. */}
      <img
        src={oxconAssets.fullHeightOx}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <img
        src={oxconAssets.wordmark}
        alt="Oxide"
        className="absolute"
        style={{
          left: gridX(grid, { col: 2, row: 0 }),
          top: gridY(grid, { row: 3 }),
          width: 273,
        }}
      />
      <DeckText
        style="display-lg"
        col={2}
        row={19}
        anchor="baseline"
        className="deck-accent"
        as="h1"
      >
        <Markdown content={data.title} field="title" />
      </DeckText>
    </Slide>
  )
}
