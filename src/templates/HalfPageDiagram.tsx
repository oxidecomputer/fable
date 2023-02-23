import { z } from 'zod'

import { Markdown } from './Util'

export const Schema = z.object({
  title: z.string().optional(),
  diagram: z.string(),
  font_size: z.string().optional(),
  text: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data, className }: { data: Schema; className?: string }) => {
  const { title, diagram, font_size, text } = data

  return (
    <div className={`flex ${className}`}>
      <div className="w-1/2 page-padding flex flex-col justify-center space-y-[20px]">
        {title && (
          <h1 className="large-title !mb-[20px] text-accent">
            <Markdown content={title} />
          </h1>
        )}

        {text && (
          <div className="markdown body-md">
            <Markdown content={text} />
          </div>
        )}
      </div>

      <div className="w-1/2 bg-accent-secondary">
        <pre className="h-full flex items-center justify-center !mt-0 !p-0 border-0 text-accent">
          <code style={{ fontSize: font_size ? font_size : 'inherit' }}>{diagram}</code>
        </pre>
      </div>
    </div>
  )
}
