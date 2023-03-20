import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  diagram: z.string(),
  font_size: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title, diagram, font_size } = data

  return (
    <div className="page-padding flex flex-col bg-accent-secondary">
      {title && (
        <h1 className="body-sm !text-accent-tertiary">
          <Markdown content={title} />
        </h1>
      )}

      <pre className="h-full flex items-center justify-center !mt-0 !p-0 border-0 text-accent">
        <code style={{ fontSize: font_size ? font_size : 'inherit' }}>{diagram}</code>
      </pre>
    </div>
  )
}
