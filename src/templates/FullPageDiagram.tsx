import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  diagram: z.string(),
  diagram_font_size: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title, diagram, diagram_font_size } = data

  return (
    <div className="page-padding flex flex-col bg-indigo-950">
      {title && (
        <h1 className="body-sm !text-indigo-500">
          <Markdown content={title} />
        </h1>
      )}

      <pre
        className="h-full flex items-center justify-center !mt-0 !p-0 border-0 text-indigo-300"
        style={{
          fontSize: diagram_font_size ? diagram_font_size : 'inherit',
          lineHeight: 1.4,
        }}
      >
        {diagram}
      </pre>
    </div>
  )
}
