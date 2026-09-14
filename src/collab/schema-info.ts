import { z } from 'zod'

import { LONG_FORM_FIELDS } from '../content/long-form'
import { unwrapEffects } from '../templates/validation'
import { fieldMeta } from './fields'

/**
 * Human/agent-readable description of a template's fields, derived from its
 * Zod schema — the same unwrapping rules the editor uses.
 */
export function describeSchema(schema: z.ZodTypeAny | undefined): Record<string, string> {
  if (!schema) return {}
  const s = unwrapEffects(schema)
  if (!(s instanceof z.ZodObject)) return {}

  const out: Record<string, string> = {}
  for (const [key, fieldSchema] of Object.entries(
    s.shape as Record<string, z.ZodTypeAny>,
  )) {
    let core: any = fieldSchema
    let optional = false
    while (core instanceof z.ZodOptional || core instanceof z.ZodNullable) {
      optional = true
      core = core._def.innerType
    }
    let type = 'unknown'
    const meta = fieldMeta(core)
    if (meta?.kind === 'image')
      type = 'image (URL, /public path, or fable:<fileId> room file)'
    else if (meta?.kind === 'markdown')
      type = meta.images ? 'markdown string (inline images allowed)' : 'markdown string'
    else if (core instanceof z.ZodEnum)
      type = `enum(${(core.options as string[]).join(' | ')})`
    else if (core instanceof z.ZodArray && core.element instanceof z.ZodString)
      type = 'string[]'
    else if (core instanceof z.ZodArray && core.element instanceof z.ZodObject)
      type = `{ ${Object.keys(core.element.shape).join(', ')} }[]`
    else if (core instanceof z.ZodString)
      type = LONG_FORM_FIELDS.has(key) ? 'markdown string' : 'string'
    else if (core instanceof z.ZodNumber) type = 'number'
    else if (core instanceof z.ZodBoolean) type = 'boolean'
    const described = optional ? `${type} (optional)` : type
    // .describe() may sit on the outer wrapper or inside .optional().
    const note = fieldSchema.description ?? core.description
    out[key] = note ? `${described} — ${note}` : described
  }
  return out
}
