import { useEffect, useState } from 'react'
import { table } from 'table'
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
          // prettyTable((parsedMeta as z.SafeParseError<any>).error.issues)
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
      <div className="bg-default relative w-full h-full">
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

/** Get longest length for the column */
const colWidth = (rows: z.ZodIssue[], colKey: keyof z.ZodIssue) => {
  const lengths = rows.map((row) => {
    const col = row[colKey]
    return col ? col.toString().length : 0
  })
  lengths.sort()
  return lengths[lengths.length - 1]
}

// Because console.table doesn't wrap cell contents
function prettyTable(rows: Error[]) {
  const terminalWidth = 120 // fallback for CI
  // wrap message but only if it's needed
  const notMsgWidth = colWidth(rows, 'path') + colWidth(rows, 'code') + 10
  const msgWidth = Math.min(terminalWidth - notMsgWidth, colWidth(rows, 'message'))
  return table(
    [['path', 'code', 'message'], ...rows.map((row) => [row.path, row.code, row.message])],
    { columns: { 2: { wrapWord: true, width: msgWidth } } },
  )
}

export default Page
