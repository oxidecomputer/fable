import { Component, type ErrorInfo, type ReactNode, useMemo } from 'react'
import { z } from 'zod'

import { CanvasEditContext } from './templates/Util'

export type TemplateModule = {
  Template: (props: { data: any; className?: string }) => JSX.Element
  Schema?: z.ZodTypeAny
  /** Module source, when known — lets the editor fork a template into a doc template. */
  source?: string
  /** A canonical example page source for this template (docs for agents/humans). */
  example?: string
}

export type TemplateMap = Record<string, TemplateModule>

type Props = {
  data: any
  scale: number
  templates: TemplateMap
  pageNumber: ReactNode
  /** When set, text fields rendered via <Markdown field=…> edit in place. */
  onEditField?: (field: string, value: string, index?: number) => void
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

export default function Page({ data, scale, templates, pageNumber, onEditField }: Props) {
  const template = templates[data.template]
  const canvasEdit = useMemo(
    () => (onEditField ? { update: onEditField } : null),
    [onEditField],
  )

  return (
    <main
      className="absolute top-1/2 left-1/2 w-[1920px] aspect-[16/9]"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div className="fable-stage bg-default relative w-full h-full">
        {!template ? (
          <div className="page-padding flex flex-col bg-error-secondary h-full">
            <div className="rounded-lg text-error mb-4 text-mono-md !text-xl">
              Unknown template: <code>{String(data.template)}</code>
            </div>
          </div>
        ) : (
          <div className="w-full h-full children:w-full children:h-full children:overflow-hidden">
            <TemplateErrorBoundary resetKey={data}>
              <CanvasEditContext.Provider value={canvasEdit}>
                <template.Template data={data} />
              </CanvasEditContext.Provider>
            </TemplateErrorBoundary>
          </div>
        )}
        {pageNumber}
      </div>
    </main>
  )
}
