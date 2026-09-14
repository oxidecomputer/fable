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
  if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
    let inner: z.ZodTypeAny = s
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
      inner = inner._def.innerType
    }
    // An optional toggle is discoverable written out explicitly off; other
    // optional kinds have no "off" value (a placeholder would turn them on).
    return unwrapEffects(inner) instanceof z.ZodBoolean ? false : undefined
  }
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
 * Fields in `data` that the new template's schema doesn't know and whose
 * values are still the old template's untouched placeholders (or defaults) —
 * safe to drop when switching templates. Anything the author actually edited
 * is kept, so no content is lost.
 */
export function stalePlaceholderFields(
  oldSchema: z.ZodTypeAny | undefined,
  newSchema: z.ZodTypeAny | undefined,
  data: Record<string, any>,
): string[] {
  const oldS = unwrapEffects(oldSchema)
  const newS = unwrapEffects(newSchema)
  if (!(oldS instanceof z.ZodObject) || !(newS instanceof z.ZodObject)) return []
  const known = new Set(Object.keys(newS.shape as Record<string, z.ZodTypeAny>))
  const stale: string[] = []
  for (const [k, v] of Object.entries(oldS.shape as Record<string, z.ZodTypeAny>)) {
    if (known.has(k) || data[k] === undefined) continue
    const p = placeholderFor(k, v)
    if (p !== undefined && JSON.stringify(data[k]) === JSON.stringify(p)) stale.push(k)
  }
  return stale
}

/**
 * Placeholder values for every required field of `schema` that `data` doesn't
 * set (plus optional toggles, written out off) — the patch that makes a freshly
 * switched page render. Empty object when nothing is missing.
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
