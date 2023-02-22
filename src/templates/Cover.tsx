import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title } = data

  return (
    <div className="page page-padding flex flex-col justify-center !bg-secondary">
      <h1 className="large-title text-secondary pr-20">
        <Markdown content={title} />
      </h1>
    </div>
  )
}
