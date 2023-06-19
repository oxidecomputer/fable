import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { title } = data

  return (
    <div className="page-padding flex flex-col justify-center !bg-neutral-800">
      <h1 className="text-[110px] leading-[1.1] font-[300] text-neutral-400 pr-[120px]">
        <Markdown content={title} />
      </h1>
    </div>
  )
}
