import { compileTemplateCached } from '../collab/compile'
import type { TemplateMap, TemplateModule } from '../model'

export type TemplateOrigin = 'theme' | 'file' | 'document'

/** One precedence rule for rendering, inspection, and agent tools. */
export function resolveTemplates(
  layers: {
    theme: TemplateMap
    files?: TemplateMap
    document?: Record<string, string>
  },
  compile: (source: string) => TemplateModule = compileTemplateCached,
) {
  const templates: TemplateMap = { ...layers.theme, ...layers.files }
  const origins: Record<string, TemplateOrigin> = {}
  const errors: Record<string, string> = {}
  for (const name of Object.keys(layers.theme)) origins[name] = 'theme'
  for (const name of Object.keys(layers.files ?? {})) origins[name] = 'file'
  for (const [name, source] of Object.entries(layers.document ?? {})) {
    origins[name] = 'document'
    // A broken override must not silently resolve to a different layout.
    delete templates[name]
    try {
      templates[name] = compile(source)
    } catch (err) {
      errors[name] = err instanceof Error ? err.message : String(err)
    }
  }
  return { templates, origins, errors }
}
