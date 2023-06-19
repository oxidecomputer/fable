import React from 'react'
import { z } from 'zod'

import { Markdown } from '~/Util'

export const Schema = z.object({
  title: z.string(),
})

export const Template = ({ data }) => {
  const { title } = data

  return (
    <div className="page-padding flex items-center !bg-indigo-950 justify-center">
      <Markdown
        content={title}
        className="title text-[7rem] leading-[1.1] font-[300] text-center"
        inline
      />
    </div>
  )
}
