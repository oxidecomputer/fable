import { z } from 'zod'

import { LONG_FORM_FIELDS } from '../content/long-form'

/**
 * Human/agent-readable description of a template's fields, derived from its
 * Zod schema — the same unwrapping rules SchemaForm uses.
 */
export function describeSchema(schema: z.ZodTypeAny | undefined): Record<string, string> {
  if (!schema) return {}
  let s: any = schema
  while (s?._def?.typeName === 'ZodEffects') s = s._def.schema
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
    if (core instanceof z.ZodEnum) type = `enum(${(core.options as string[]).join(' | ')})`
    else if (core instanceof z.ZodArray && core.element instanceof z.ZodString)
      type = 'string[]'
    else if (core instanceof z.ZodString)
      type = LONG_FORM_FIELDS.has(key) ? 'markdown string' : 'string'
    else if (core instanceof z.ZodNumber) type = 'number'
    else if (core instanceof z.ZodBoolean) type = 'boolean'
    out[key] = optional ? `${type} (optional)` : type
  }
  return out
}
