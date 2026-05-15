import { z } from 'zod'

import { Markdown } from './Util'

const objectFit = ['contain', 'cover', 'fill', 'none', 'scale-down'] as const
export type ObjectFit = (typeof objectFit)[number]

export const Schema = z.object({
  image: z.string(),
  bg_color: z.string().optional(),
  object_fit: z.enum(objectFit).optional(),
  title: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { image, bg_color, object_fit, title } = data

  const fit = object_fit ? object_fit : 'cover'

  return (
    <div
      className="flex relative"
      style={{
        backgroundColor: bg_color,
      }}
    >
      <img
        src={image}
        className="absolute w-full h-full object-cover"
        style={{
          objectFit: fit as ObjectFit,
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
