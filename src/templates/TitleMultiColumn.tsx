import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  text: z.array(z.string()).optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { text, title } = data

  return (
    <div className="page-padding flex flex-col">
      <div className="basis-1/2">
        {title && (
          <h1 className="large-title text-accent">
            <Markdown content={title} />
          </h1>
        )}
      </div>

      <hr className="mt-[60px] border-[var(--base-neutral-500)] -mx-[80px] w-[calc(100%+160px)]" />

      {text && (
        <div className="flex space-x-[60px]">
          {text.map((col) => (
            <Markdown content={col} className="markdown mt-12 body-sm flex-grow basis-0" />
          ))}
        </div>
      )}
    </div>
  )
}
