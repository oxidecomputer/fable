import { DeckText, GridLines, HeaderBand, Markdown, Slide, toneVariant } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  stat: z.string(),
  text: z.string(),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const dark = data.variant === 'dark'

  return (
    <Slide tone={data.variant ?? 'light'}>
      <GridLines cull={() => false} opacity={dark ? 0.5 : 0.3} />
      <HeaderBand />
      <DeckText style="display-lg" row={9} className="deck-accent" as="h1">
        <Markdown content={data.stat} field="stat" />
      </DeckText>
      <DeckText style="display-md" row={14} className="deck-muted">
        <Markdown content={data.text} field="text" />
      </DeckText>
    </Slide>
  )
}
