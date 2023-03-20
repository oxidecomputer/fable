import { z } from 'zod'

import { Markdown } from './Util'

export type ObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

export const Schema = z.object({
  src: z.string(),
  bg_color: z.string().optional(),
  object_fit: z.string().optional(),
  title: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

interface SchemaType extends Omit<Schema, 'object_fit'> {
  object_fit: ObjectFit
}

export const Template = ({ data }: { data: SchemaType }) => {
  const { src, bg_color, object_fit, title } = data

  const fit = object_fit ? object_fit : 'cover'

  return (
    <div
      className="flex relative"
      style={{
        backgroundColor: bg_color,
      }}
    >
      <img
        src={src}
        className="absolute w-full h-full object-cover"
        style={{
          objectFit: fit,
        }}
      />

      {title && (
        <div className="page-padding">
          <h1 className="relative body-sm">
            <Markdown content={title} />
          </h1>
        </div>
      )}
    </div>
  )
}
