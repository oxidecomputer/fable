import type { TemplateMap } from './Page'

/**
 * A theme is a centrally versioned bundle of templates (plus optional CSS),
 * selected at build/deploy time. Extend one by spreading its `templates` and
 * adding or overriding entries.
 */
export type Theme = {
  name: string
  templates: TemplateMap
  css?: string
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
