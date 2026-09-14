import type { ReactElement } from 'react'
import type { z } from 'zod'

/** Authoring data stays open-ended: each template owns its field schema. */
export type PageData = Record<string, any> & { template: string }

export type DeckMeta = {
  title?: string
  config?: { page_numbers?: boolean }
}

export type DeckContent = DeckMeta & { pages: PageData[] }

export type TemplateModule = {
  Template: (props: { data: any; className?: string }) => ReactElement
  Schema?: z.ZodTypeAny
  /** Source for forking theme/file templates into editable document templates. */
  source?: string
  /** Canonical page source for humans, agents, and template contract tests. */
  example?: string
  /** One-line intent — when to reach for this template (and when not to). */
  description?: string
}

export type TemplateMap = Record<string, TemplateModule>
export type TemplateExports = Readonly<Record<string, unknown>>
