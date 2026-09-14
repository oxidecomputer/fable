import { z } from 'zod'

/**
 * Field-kind annotations for template schemas. A field is still a plain
 * string in the page source (so pages serialize/parse unchanged); the
 * annotation tells the editor and agents what the string holds:
 *
 * - `imageField()` — an image reference: a URL, a `public/` path, or a
 *   room-stored file ref (`fable:<fileId>`, see src/files.tsx). Enables the
 *   drop-to-upload affordance on the edit stage.
 * - `markdownField({ images: true })` — a rich text field that accepts inline
 *   images (`![alt](fable:<fileId>)`); pasting an image while editing it
 *   in-canvas uploads to the room and inserts the ref.
 *
 * The marker lives on the schema instance itself, so it survives `.optional()`
 * and friends (they wrap; {@link fieldMeta} unwraps).
 */
export type FieldMeta = { kind: 'image' } | { kind: 'markdown'; images: boolean }

/** An image reference field: URL, public/ path, or `fable:<fileId>` room file. */
export function imageField(): z.ZodString {
  const s = z.string()
  ;(s as any)._fable = { kind: 'image' } satisfies FieldMeta
  return s
}

/** A markdown field; `images: true` opts it into inline image upload/paste. */
export function markdownField(opts: { images?: boolean } = {}): z.ZodString {
  const s = z.string()
  ;(s as any)._fable = { kind: 'markdown', images: !!opts.images } satisfies FieldMeta
  return s
}

/** The field-kind annotation of a schema, unwrapping optional/nullable/default/effects. */
export function fieldMeta(schema: z.ZodTypeAny | undefined): FieldMeta | undefined {
  let s: any = schema
  for (;;) {
    if (!s) return undefined
    if (s._fable) return s._fable
    if (s._def?.typeName === 'ZodEffects') s = s._def.schema
    else if (
      s instanceof z.ZodOptional ||
      s instanceof z.ZodNullable ||
      s instanceof z.ZodDefault
    )
      s = s._def.innerType
    else return undefined
  }
}

/** Top-level keys of an object schema annotated as image fields. */
export function imageFieldKeys(schema: z.ZodTypeAny | undefined): string[] {
  let s: any = schema
  while (s?._def?.typeName === 'ZodEffects') s = s._def.schema
  if (!(s instanceof z.ZodObject)) return []
  return Object.entries(s.shape as Record<string, z.ZodTypeAny>)
    .filter(([, v]) => fieldMeta(v)?.kind === 'image')
    .map(([k]) => k)
}
