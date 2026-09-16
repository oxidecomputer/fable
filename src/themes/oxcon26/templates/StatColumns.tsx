import { HeaderBand, Markdown, Slide, toneVariant } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  columns: z
    .array(z.object({ stat: z.string(), label: z.string() }))
    .min(1)
    .max(4),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  return (
    <Slide tone={data.variant ?? 'dark'}>
      <HeaderBand />
      <div className="flex h-full flex-col px-[calc(var(--grid-cell-w)*3)] pb-[calc(var(--grid-cell-h)*2)] pt-[calc(var(--grid-cell-h)*4)]">
        <div className="flex min-h-0 flex-1 gap-(--grid-cell-w)">
          {data.columns.map((column, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-1 flex-col border-l border-(--deck-hairline) pl-(--grid-cell-w)"
            >
              <div className="deck-display-lg deck-accent">
                <Markdown content={column.stat} field="columns.stat" fieldIndex={i} />
              </div>
              <div className="deck-text-md deck-muted mt-auto">
                <Markdown content={column.label} field="columns.label" fieldIndex={i} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  )
}
