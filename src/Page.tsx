import { Component, type ErrorInfo, type ReactNode } from 'react'
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

class TemplateErrorBoundary extends Component<
  { resetKey: unknown; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Template render error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-padding flex flex-col bg-error-secondary h-full">
          <div className="rounded-lg text-error mb-4 text-mono-md !text-xl">
            Template error
          </div>
          <pre className="text-mono-md text-error whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Page({ data, scale, templates, pageNumber }: Props) {
  const template = templates[data.template]

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
        ) : (
          <div className="w-full h-full children:w-full children:h-full children:overflow-hidden">
            <TemplateErrorBoundary resetKey={data}>
              <template.Template data={data} />
            </TemplateErrorBoundary>
          </div>
        )}
        {pageNumber}
      </div>
    </main>
  )
}
