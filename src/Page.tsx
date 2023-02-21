import { useEffect, useState } from 'react'

type Component = {
  template: ({ data }: { data: any }) => JSX.Element
  schema: any
}

function Page({ data, scale }: any) {
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
      className="bg-default absolute top-1/2 left-1/2 w-[1920px] aspect-[16/9]"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <component.template data={data} />
    </main>
  )
}

export default Page
