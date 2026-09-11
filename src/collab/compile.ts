import * as ReactModule from 'react'
import { transform } from 'sucrase'
import * as ZodModule from 'zod'

import type { TemplateModule } from '../Page'
import { FitText, Markdown } from '../templates/Util'

/**
 * Modules doc-stored templates may import. Anything else is a compile error
 * — template code runs in every room member's browser with no network
 * fetch, so the import surface is a fixed injected scope.
 */
const MODULES: Record<string, any> = {
  react: ReactModule,
  zod: ZodModule,
  '@oxide/fable': { Markdown, FitText },
  // Alias used by the built-in theme templates, so a built-in's source can
  // be forked into a doc template and compile unchanged.
  './Util': { Markdown, FitText },
}

/**
 * Compile a doc-stored template's TSX module source into a TemplateModule.
 * Uses sucrase (typescript + jsx + imports → CJS) and evaluates with a
 * require shim limited to {@link MODULES}. Throws on syntax errors, unknown
 * imports, or a missing `Template` export.
 */
export function compileTemplate(source: string): TemplateModule {
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  })

  const moduleShim = { exports: {} as Record<string, any> }
  const requireShim = (id: string) => {
    if (id in MODULES) return MODULES[id]
    throw new Error(`Import not available in doc templates: "${id}"`)
  }

  const fn = new Function('require', 'exports', 'module', 'React', code)
  fn(requireShim, moduleShim.exports, moduleShim, ReactModule)

  const exports = moduleShim.exports
  const Template = exports.Template ?? exports.default
  if (typeof Template !== 'function') {
    throw new Error('Template module must export a `Template` function')
  }
  const result: TemplateModule = { Template }
  if (exports.Schema) result.Schema = exports.Schema
  return result
}

const cache = new Map<string, TemplateModule>()

/** Memoized {@link compileTemplate} keyed by source string. */
export function compileTemplateCached(source: string): TemplateModule {
  const hit = cache.get(source)
  if (hit) return hit
  const compiled = compileTemplate(source)
  if (cache.size > 50) cache.clear()
  cache.set(source, compiled)
  return compiled
}

export const NEW_TEMPLATE_SOURCE = `import { z } from 'zod'
import { Markdown } from '@oxide/fable'

export const Schema = z.object({
  title: z.string(),
  text: z.string().optional(),
})

export function Template({ data }) {
  return (
    <div className="page-padding flex flex-col h-full">
      <h1 className="large-title"><Markdown content={data.title} field="title" /></h1>
      {data.text && <Markdown className="body-md body-padding flex-grow" content={data.text} />}
    </div>
  )
}
`
