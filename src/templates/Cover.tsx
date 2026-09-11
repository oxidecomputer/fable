import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title } = data

  return (
    <div className="page-padding flex flex-col justify-center bg-raise">
      <h1 className="text-[110px] leading-[1.1] font-[300] text-raise pr-[120px] tracking-[-0.02em]">
        <Markdown content={title} field="title" />
      </h1>
    </div>
  )
}
