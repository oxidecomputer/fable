import {
  DeckText,
  GridLines,
  HeaderBand,
  Markdown,
  ShaderBackground,
  Silkscreen,
  Slide,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide>
      <ShaderBackground />
      <Silkscreen opacity={0.25} />
      <GridLines />
      <HeaderBand />
      {/* Title's (last) baseline sits seven rows up from the bottom, leaving
          the bottom band to the grid lines. */}
      <DeckText
        style="display-lg"
        row={15}
        anchor="baseline"
        className="deck-accent"
        as="h1"
      >
        <Markdown content={data.title} field="title" />
      </DeckText>
    </Slide>
  )
}
