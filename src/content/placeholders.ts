import { z } from 'zod'

import { fieldMeta } from '../collab/fields'
import { unwrapEffects } from '../templates/validation'

function labelFor(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * A stand-in value for a required schema field with no value yet (typically
 * right after switching templates), readable enough to present as-is until
 * the author replaces it.
 */
function placeholderFor(key: string, schema: z.ZodTypeAny): unknown {
  const s = unwrapEffects(schema)
  if (s instanceof z.ZodDefault) return s._def.defaultValue()
  // Optional fields are the template's problem — placeholder only required ones.
  if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) return undefined
  if (s instanceof z.ZodEnum) return s.options[0]
  // An image field needs a real src, not label text.
  if (fieldMeta(s)?.kind === 'image') return '/large-placeholder.svg'
  if (s instanceof z.ZodString) return labelFor(key)
  if (s instanceof z.ZodNumber) return 1
  if (s instanceof z.ZodBoolean) return false
  if (s instanceof z.ZodArray) {
    return Array.from({ length: 3 }, (_, i) => {
      const item = placeholderFor(key, s.element)
      return typeof item === 'string' ? `${item} ${i + 1}` : item
    })
  }
  if (s instanceof z.ZodObject) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(s.shape as Record<string, z.ZodTypeAny>)) {
      const p = placeholderFor(k, v)
      if (p !== undefined) out[k] = p
    }
    return out
  }
  return undefined
}

/**
 * Placeholder values for every required field of `schema` that `data` doesn't
 * set — the patch that makes a freshly switched page render. Empty object when
 * nothing is missing.
 */
export function missingFieldPlaceholders(
  schema: z.ZodTypeAny | undefined,
  data: Record<string, any>,
): Record<string, unknown> {
  const s = unwrapEffects(schema)
  if (!(s instanceof z.ZodObject)) return {}
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s.shape as Record<string, z.ZodTypeAny>)) {
    if (data[k] !== undefined) continue
    const p = placeholderFor(k, v)
    if (p !== undefined) patch[k] = p
  }
  return patch
}
