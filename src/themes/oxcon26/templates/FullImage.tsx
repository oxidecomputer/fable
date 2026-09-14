import {
  DeckText,
  HeaderBand,
  Markdown,
  Slide,
  SlideImage,
  colsW,
  imageField,
  toneVariant,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  image: imageField(),
  caption: z.string().optional(),
  variant: toneVariant.describe('overlay text tone: dark = light text (the default)'),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide tone={data.variant ?? 'dark'}>
      <SlideImage
        value={data.image}
        field="image"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <HeaderBand />
      {data.caption && (
        <DeckText style="text-md" row={-2} width={colsW(5)} className="deck-muted">
          <Markdown content={data.caption} field="caption" />
        </DeckText>
      )}
    </Slide>
  )
}
