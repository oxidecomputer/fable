import { useEffect, useState } from 'react'

type Component = {
  template: ({ data, className }: { data: any; className?: string }) => JSX.Element
  schema: any
}

function Page({ data, scale, pageNumber }: any) {
  const [component, setComponent] = useState<Component>()

  useEffect(() => {
    async function getTemplate() {
      const template = await import(/* @vite-ignore */ `./templates/${data.template}.tsx`)

      setComponent({
        template: template.Template,
        schema: template.Schema,
      })
    }

    if (!component) {
      getTemplate()
    }
  }, [])

  if (!component || !data) {
    return null
  }

  component.schema.parse(data)

  return (
    <main
      className="absolute top-1/2 left-1/2 w-[1920px] aspect-[16/9]"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div className="bg-default relative w-full h-full">
        <component.template data={data} className="w-full h-full" />
        {pageNumber}
      </div>
    </main>
  )
}

export default Page
