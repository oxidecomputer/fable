import hljs from 'highlight.js'
import { z } from 'zod'

export const Schema = z.object({
  title: z.string(),
  code: z.string(),
  lang: z.string(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { code, title, lang } = data

  const highlighted = hljs.highlight(code, { language: lang }).value

  return (
    <div className="page page-padding flex flex-col">
      <h1 className="large-title">{title}</h1>

      <pre className="code-block">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
