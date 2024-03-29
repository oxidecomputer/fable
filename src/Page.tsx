import { useEffect, useState } from 'react'
import { z } from 'zod'

type Component = {
  template: ({ data, className }: { data: any; className?: string }) => JSX.Element
  schema: any
}

type Error = z.ZodIssue

function Page({ data, scale, pageNumber }: any) {
  const [component, setComponent] = useState<Component>()
  const [errors, setErrors] = useState<Error[]>()

  useEffect(() => {
    async function getTemplate() {
      const dir = data.custom_template ? `${window.ENV.dir}templates/` : './templates/'
      const suffix = data.custom_template ? 'jsx' : 'tsx'

      const template = await import(/* @vite-ignore */ `${dir}${data.template}.${suffix}`)
      const schema = template.Schema

      if (schema) {
        const parsedMeta = schema.safeParse(data)

        if (!parsedMeta.success) {
          console.error("Can't parse slide data")
          setErrors(parsedMeta.error.issues)
          console.log(parsedMeta)
        }
      }

      setComponent({
        template: template.Template,
        schema: schema,
      })
    }

    if (!component && data) {
      getTemplate()
    }
  }, [component, data])

  if (!component || !data) {
    return null
  }

  return (
    <main
      className="absolute top-1/2 left-1/2 w-[1920px] aspect-[16/9]"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div className="bg-neutral-900 relative w-full h-full">
        {errors ? (
          <div className="page-padding flex flex-col bg-error-secondary h-full">
            <div className="rounded-lg text-error mb-4 text-mono-md !text-xl">
              Content errors
            </div>
            <table className="error-table">
              {errors.map((error) => (
                <>
                  <tr>
                    <th>Path</th>
                    <th>Code</th>
                    <th>Message</th>
                  </tr>
                  <tr>
                    <td>{error.path}</td>
                    <td>{error.code}</td>
                    <td>{error.message}</td>
                  </tr>
                </>
              ))}
            </table>
          </div>
        ) : (
          <div className="w-full h-full children:w-full children:h-full children:overflow-hidden">
            <component.template data={data} />
          </div>
        )}
        {pageNumber}
      </div>
    </main>
  )
}

export default Page
