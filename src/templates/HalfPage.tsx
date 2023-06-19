import { z } from 'zod'

import type { ObjectFit } from './FullPageImage'
import { Markdown } from './Util'

export const Schema = z
  .object({
    title: z.string().optional(),
    diagram: z.string(),
    image: z.string(),
    object_fit: z.string().optional(),
    diagram_font_size: z.string().optional(),
    text: z.string().optional(),
  })
  .partial()
  .refine(({ diagram, image }) => diagram !== undefined || image !== undefined, {
    message: 'Either diagram or image must be defined',
  })

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title, object_fit, image, diagram, diagram_font_size, text } = data

  const fit = object_fit ? object_fit : 'cover'

  return (
    <div className="flex">
      <div className="w-1/2 page-padding flex flex-col justify-center space-y-[20px]">
        {title && (
          <h1 className="large-title !mb-[20px] text-indigo-300">
            <Markdown content={title} />
          </h1>
        )}

        {text && (
          <div className="markdown body-md">
            <Markdown content={text} />
          </div>
        )}
      </div>

      <div className={`w-1/2 ${diagram ? 'bg-indigo-950' : ''} relative`}>
        {image ? (
          <img
            src={image}
            className="absolute w-full h-full object-cover"
            style={{
              objectFit: fit as ObjectFit,
            }}
          />
        ) : (
          <pre
            className="h-full flex items-center justify-center !mt-0 !p-0 border-0 text-indigo-300"
            style={{
              fontSize: diagram_font_size ? diagram_font_size : 'inherit',
              lineHeight: 1.4,
            }}
          >
            {diagram}
          </pre>
        )}
      </div>
    </div>
  )
}
