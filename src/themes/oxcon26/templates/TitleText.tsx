import { DeckText, HeaderBand, Markdown, Slide, toneVariant } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
  text: z.string(),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide tone={data.variant ?? 'light'}>
      <HeaderBand />
      <DeckText style="display-md" row={2} anchor="top" className="deck-strong" as="h1">
        <Markdown content={data.title} field="title" />
      </DeckText>
      <DeckText style="text-md" row={10} anchor="top" className="deck-muted">
        <Markdown content={data.text} field="text" />
      </DeckText>
    </Slide>
  )
}
