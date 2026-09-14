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
      <DeckText
        style="display-lg"
        row={15}
        anchor="baseline"
        autofit={{ lines: 2 }}
        className="deck-accent"
        as="h1"
      >
        <Markdown content={data.title} field="title" />
      </DeckText>
    </Slide>
  )
}
