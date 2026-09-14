import { DeckText, HeaderBand, Markdown, Slide } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  text: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide tone="light">
      <HeaderBand />
      <DeckText style="display-sm" row={4} autofit anchor="first-baseline">
        <Markdown content={data.text} field="text" />
      </DeckText>
    </Slide>
  )
}
