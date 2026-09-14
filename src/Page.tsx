import { Component, type ErrorInfo, type ReactNode, useMemo } from 'react'

import type { TemplateMap } from './model'
import { PageInfoContext, StageContext, type StageMode } from './stage'
import { CanvasEditContext } from './templates/Util'

export type { TemplateMap, TemplateModule } from './model'
export { PageInfoContext, useStage } from './stage'
export type { StageMode } from './stage'

type Props = {
  data: any
  scale: number
  templates: TemplateMap
  pageNumber: ReactNode
  /** Drawn over the slide in fixed stage coordinates (e.g. the grid overlay). */
  overlay?: ReactNode
  /** Rendering surface, exposed to templates via useStage. Default 'stage'. */
  mode?: StageMode
  /** Slide position for templates that render it (via PageInfoContext). */
  pageInfo?: { number: number; total: number } | null
  /** When set, text fields rendered via <Markdown field=…> edit in place. */
  onEditField?: (field: string, value: string, index?: number) => void
  /** Publish which field this client is editing on the canvas (presence). */
  onEditingField?: (fieldKey: string | null) => void
  /** Fields collaborators have selected on this slide: fieldKey → their color. */
  remoteFieldSelections?: Record<string, string>
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

export default function Page({
  data,
  scale,
  templates,
  pageNumber,
  overlay,
  mode = 'stage',
  pageInfo = null,
  onEditField,
  onEditingField,
  remoteFieldSelections,
}: Props) {
  const template = templates[data.template]
  const canvasEdit = useMemo(
    () =>
      onEditField
        ? {
            update: onEditField,
            setEditing: onEditingField,
            remoteSelections: remoteFieldSelections,
          }
        : null,
    [onEditField, onEditingField, remoteFieldSelections],
  )
  const stage = useMemo(() => ({ scale, mode }), [scale, mode])
  const resetKey = useMemo(() => ({ data, template }), [data, template])

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
            <TemplateErrorBoundary resetKey={resetKey}>
              <StageContext.Provider value={stage}>
                <PageInfoContext.Provider value={pageInfo}>
                  <CanvasEditContext.Provider value={canvasEdit}>
                    <template.Template data={data} />
                  </CanvasEditContext.Provider>
                </PageInfoContext.Provider>
              </StageContext.Provider>
            </TemplateErrorBoundary>
          </div>
        )}
        {pageNumber}
        {overlay}
      </div>
    </main>
  )
}
