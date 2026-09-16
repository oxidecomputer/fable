import {
  DeckText,
  HeaderBand,
  Markdown,
  ShaderBackground,
  Slide,
  colsW,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
  items: z.array(z.string()).min(1).max(4),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const width = 12 / data.items.length

  return (
    <Slide>
      <ShaderBackground />
      <HeaderBand />
      {data.items.map((item, i) => (
        <div key={i}>
          <DeckText
            style="text-md"
            col={i * width}
            row={4}
            width={colsW(width)}
            className="deck-accent"
          >
            {String(i + 1).padStart(2, '0')}
          </DeckText>
          <DeckText
            style="text-md"
            col={i * width}
            row={6}
            width={colsW(width)}
            className="text-raise pr-(--grid-cell-w)"
          >
            <Markdown content={item} field="items" fieldIndex={i} />
          </DeckText>
        </div>
      ))}
      <DeckText
        style="display-lg"
        row={20}
        width={colsW(8)}
        autofit={{ lines: 2 }}
        anchor="baseline"
        className="deck-accent"
        as="h1"
      >
        <Markdown content={data.title} field="title" />
      </DeckText>
    </Slide>
  )
}
