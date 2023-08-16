import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
  text_font_size: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { text, title, text_font_size } = data

  console.log(text)

  return (
    <div className="page-padding flex flex-col">
      {title && (
        <h1 className="large-title text-indigo-300">
          <Markdown content={title} />
        </h1>
      )}

      {text && (
        <div
          className="markdown body-md body-padding flex-grow"
          style={{ fontSize: text_font_size }}
        >
          <Markdown content={text} />
        </div>
      )}
    </div>
  )
}
