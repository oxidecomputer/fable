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
          <h1 className="large-title">
            <Markdown content={title} field="title" />
          </h1>
        )}
      </div>

      <hr className="mt-[60px] border-default -mx-[80px] w-[calc(100%+160px)]" />

      {text && (
        <div className="flex space-x-[60px]">
          {text.map((col, idx) => (
            <Markdown
              key={idx}
              content={col}
              field="text"
              fieldIndex={idx}
              className="markdown mt-4 body-sm flex-grow basis-0"
            />
          ))}
        </div>
      )}
    </div>
  )
}
