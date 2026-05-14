import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

export type TemplateModule = {
  Template: (props: { data: any; className?: string }) => JSX.Element
  Schema?: z.ZodTypeAny
}

export type TemplateMap = Record<string, TemplateModule>

type Props = {
  data: any
  scale: number
  templates: TemplateMap
  pageNumber: ReactNode
}

export default function Page({ data, scale, templates, pageNumber }: Props) {
  const template = templates[data.template]

  const errors = useMemo<z.ZodIssue[] | null>(() => {
    if (!template?.Schema) return null
    const { template: _t, custom_template: _ct, ...rest } = data
    const schema =
      template.Schema instanceof z.ZodObject ? template.Schema.strict() : template.Schema
    const parsed = schema.safeParse(rest)
    return parsed.success ? null : parsed.error.issues
  }, [template, data])

  return (
    <main
      className="absolute top-1/2 left-1/2 w-[1920px] aspect-[16/9]"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div className="bg-neutral-900 relative w-full h-full">
        {!template ? (
          <div className="page-padding flex flex-col bg-error-secondary h-full">
            <div className="rounded-lg text-error mb-4 text-mono-md !text-xl">
              Unknown template: <code>{String(data.template)}</code>
            </div>
          </div>
        ) : errors ? (
          <div className="page-padding flex flex-col bg-error-secondary h-full">
            <div className="rounded-lg text-error mb-4 text-mono-md !text-xl">
              Content errors
            </div>
            <table className="error-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Code</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, i) => (
                  <tr key={i}>
                    <td>{error.path.join('.')}</td>
                    <td>{error.code}</td>
                    <td>{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-full children:w-full children:h-full children:overflow-hidden">
            <template.Template data={data} />
          </div>
        )}
        {pageNumber}
      </div>
    </main>
  )
}
