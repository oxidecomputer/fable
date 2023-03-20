import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  text: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { text, title } = data

  return (
    <div className="page-padding flex flex-col">
      {title && (
        <h1 className="large-title text-accent">
          <Markdown content={title} />
        </h1>
      )}

      {text && (
        <div className="markdown body-md body-padding">
          <Markdown content={text} />
        </div>
      )}
    </div>
  )
}
