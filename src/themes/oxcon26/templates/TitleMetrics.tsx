import {
  HeaderBand,
  Markdown,
  Slide,
  SlideImage,
  imageField,
  toneVariant,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
  metrics: z
    .array(z.object({ label: z.string(), value: z.string(), text: z.string() }))
    .min(1)
    .max(4),
  image: imageField().optional(),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide tone={data.variant ?? 'light'}>
      {data.image && (
        <SlideImage
          value={data.image}
          field="image"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}
      <HeaderBand left="OXIDE" />
      <div className="flex h-full flex-col px-[calc(var(--grid-cell-w)*3)] pb-[calc(var(--grid-cell-h)*2)] pt-[calc(var(--grid-cell-h)*3)]">
        <h1 className="deck-display-md deck-strong m-0">
          <Markdown content={data.title} field="title" />
        </h1>
        <div className="mt-[calc(var(--grid-cell-h)*3)] flex min-h-0 flex-1 gap-(--grid-cell-w)">
          {data.metrics.map((metric, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-1 flex-col border-l border-(--deck-hairline) pl-(--grid-cell-w)"
            >
              <div className="deck-text-md deck-strong">
                <Markdown content={metric.label} field="metrics.label" fieldIndex={i} />
              </div>
              <div className="deck-display-md deck-strong mt-[calc(var(--grid-cell-h)/2)]">
                <Markdown content={metric.value} field="metrics.value" fieldIndex={i} />
              </div>
              <div className="deck-text-sm deck-muted mt-auto">
                <Markdown content={metric.text} field="metrics.text" fieldIndex={i} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  )
}
