import type { ComponentType } from 'react'

import type { TemplateExports, TemplateMap } from './model'

/**
 * A theme is a centrally versioned bundle of templates (plus optional CSS),
 * selected at build/deploy time. Extend one by spreading its `templates` and
 * adding or overriding entries.
 */
export type Theme = {
  name: string
  templates: TemplateMap
  /** Additional @oxide/fable imports available inside this theme's live templates. */
  templateExports?: TemplateExports
  css?: string
  /**
   * Reference overlay drawn over the edit stage (fixed 1920×1080 coordinates)
   * when the grid view setting is on — typically the theme's layout grid.
   * Themes without one simply have nothing to show.
   */
  gridOverlay?: ComponentType
  /**
   * Guidance passed to the AI assistant as knowledge, letting theme authors
   * nudge it toward the theme's idioms (which templates to reach for, tone,
   * layout conventions).
   */
  aiInstructions?: string
  /**
   * The theme's design document (markdown): tokens, typography, principles.
   * Served to agents via the MCP read_theme tool.
   */
  designDoc?: string
}
