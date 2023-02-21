import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string(),
  text: z.string().optional(),
  list: z.array(z.string()).optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { text, title, list } = data

  return (
    <div className="page page-padding flex flex-col justify-between">
      <h1 className="large-title">{title}</h1>

      {list && (
        <ul>
          {list.map((item: string, index: number) => (
            <li key={index} className="list-item">
              <Markdown content={item} />
            </li>
          ))}
        </ul>
      )}

      {text && (
        <div className="body-md pr-[120px]">
          <Markdown content={text} />
        </div>
      )}
    </div>
  )
}
