import { DeckText, HeaderBand, Markdown, Slide, colsW, toneVariant } from '@oxide/fable'
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
      <DeckText
        style="display-sm"
        row={4}
        autofit={{ lines: 1 }}
        className="deck-strong"
        as="h1"
        width={colsW(11)}
      >
        <Markdown content={data.title} field="title" />
      </DeckText>
      <DeckText style="text-lg" row={7} className="deck-muted" width={colsW(11)}>
        <Markdown content={data.text} field="text" />
      </DeckText>
    </Slide>
  )
}
