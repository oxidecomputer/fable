import { Slide, colsW, gridX, gridY, stageGrid, toneVariant, useStage } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  url: z.string().url().describe('the page to embed'),
  window: z
    .boolean()
    .optional()
    .describe('true frames the page in a faux browser window instead of full-bleed'),
  variant: toneVariant,
})

type Schema = z.infer<typeof Schema>

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups'

/** The live page — thumbnails show the URL instead of loading the iframe. */
const LivePage = ({ url, className }: { url: string; className: string }) => {
  const { mode } = useStage()
  if (mode === 'thumbnail') {
    return <div className="size-full bg-tertiary" />
  }
  return (
    <iframe
      src={url}
      title={url}
      className={`${className} border-0`}
      allow="fullscreen"
      sandbox={SANDBOX}
    />
  )
}

export const Template = ({ data }: { data: Schema }) => {
  if (!data.window) {
    return (
      <Slide tone={data.variant ?? 'dark'}>
        <LivePage url={data.url} className="absolute inset-0 h-full w-full" />
      </Slide>
    )
  }

  // The window spans the full content width, from below the header band down
  // to the bottom margin, with the title bar one cell row tall.
  const left = gridX(stageGrid, { col: 0, row: 0 })
  const top = gridY(stageGrid, { row: 1 })
  const bottom = gridY(stageGrid, { row: -1 })
  return (
    <Slide tone={data.variant ?? 'dark'}>
      <div
        className="absolute flex rounded-md flex-col overflow-hidden"
        style={{
          left,
          top,
          width: colsW(12),
          height: bottom - top,
          border: '1px solid var(--deck-hairline)',
        }}
      >
        <div
          className="flex shrink-0 items-center"
          style={{
            height: stageGrid.cellH,
            paddingInline: stageGrid.u,
            gap: stageGrid.u,
            borderBottom: '1px solid var(--deck-hairline)',
          }}
        >
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-4 rounded-full"
                style={{ background: 'var(--deck-hairline)' }}
              />
            ))}
          </div>
          <span className="deck-text-xs text-quaternary truncate normal-case">
            {data.url}
          </span>
        </div>
        <LivePage url={data.url} className="min-h-0 w-full flex-1" />
      </div>
    </Slide>
  )
}
