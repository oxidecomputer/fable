import * as ReactModule from 'react'
import * as ZodModule from 'zod'

import type { TemplateExports, TemplateModule } from '../model'
import * as sdk from '../template-sdk'
import { templateModule } from '../templates/validation'
import { transpileTemplate } from './transpile'

export type TemplateCompiler = ReturnType<typeof createTemplateCompiler>

/** Each theme/session owns its import scope and compilation cache. */
export function createTemplateCompiler(themeExports: TemplateExports = {}) {
  const modules: Record<string, unknown> = {
    react: ReactModule,
    zod: ZodModule,
    '@oxide/fable': { ...themeExports, ...sdk },
    // Compatibility with existing Oxide template sources stored in rooms.
    './Util': { Markdown: sdk.Markdown, FitText: sdk.FitText },
  }
  const cache = new Map<string, TemplateModule>()

  /** Transpile, evaluate top-level code, and check exports. Does not render. */
  function compile(source: string): TemplateModule {
    const code = transpileTemplate(source)
    const moduleShim = { exports: {} as Record<string, any> }
    const requireShim = (id: string) => {
      if (Object.hasOwn(modules, id)) return modules[id]
      throw new Error(`Import not available in doc templates: "${id}"`)
    }
    const fn = new Function('require', 'exports', 'module', 'React', code)
    fn(requireShim, moduleShim.exports, moduleShim, ReactModule)
    return { ...templateModule(moduleShim.exports), source }
  }

  function compileCached(source: string): TemplateModule {
    const hit = cache.get(source)
    if (hit) return hit
    const compiled = compile(source)
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(source, compiled)
    return compiled
  }

  return { compile, compileCached }
}

const defaultCompiler = createTemplateCompiler()
export const compileTemplate = defaultCompiler.compile
export const compileTemplateCached = defaultCompiler.compileCached

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
