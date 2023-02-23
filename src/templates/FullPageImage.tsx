import { z } from 'zod'

export type ObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

export const Schema = z.object({
  src: z.string(),
  bg_color: z.string().optional(),
  object_fit: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

interface SchemaType extends Omit<Schema, 'object_fit'> {
  object_fit: ObjectFit
}

export const Template = ({ data, className }: { data: SchemaType; className?: string }) => {
  const { src, bg_color, object_fit } = data

  const fit = object_fit ? object_fit : 'cover'

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        backgroundColor: bg_color,
      }}
    >
      <img
        src={src}
        className="w-full h-full object-cover"
        style={{
          objectFit: fit,
        }}
      />
    </div>
  )
}
