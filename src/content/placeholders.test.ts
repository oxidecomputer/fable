import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { missingFieldPlaceholders, stalePlaceholderFields } from './placeholders'

describe('missingFieldPlaceholders', () => {
  it('fills only missing required fields', () => {
    const schema = z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      count: z.number(),
      kind: z.enum(['spark', 'ember']),
      items: z.array(z.string()),
      people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
      flag: z.boolean(),
      speed: z.number().default(4),
      window: z.boolean().optional(),
    })
    const patch = missingFieldPlaceholders(schema, { title: 'kept' })
    expect(patch).toEqual({
      count: 1,
      kind: 'spark',
      items: ['Items 1', 'Items 2', 'Items 3'],
      people: [{ name: 'Name' }, { name: 'Name' }, { name: 'Name' }],
      flag: false,
      speed: 4,
      // Optional toggles are written out explicitly off, so they're discoverable
      window: false,
    })
  })

  it('labelizes snake_case field names', () => {
    const schema = z.object({ image_caption: z.string() })
    expect(missingFieldPlaceholders(schema, {})).toEqual({
      image_caption: 'Image Caption',
    })
  })

  it('returns an empty patch for non-object schemas or complete data', () => {
    expect(missingFieldPlaceholders(undefined, {})).toEqual({})
    expect(missingFieldPlaceholders(z.string(), {})).toEqual({})
    expect(missingFieldPlaceholders(z.object({ a: z.string() }), { a: 'x' })).toEqual({})
  })
})

describe('stalePlaceholderFields', () => {
  const oldSchema = z.object({
    title: z.string(),
    items: z.array(z.string()),
    speed: z.number().default(4),
    caption: z.string().optional(),
  })
  const newSchema = z.object({ title: z.string(), body: z.string() })

  it('drops untouched placeholders and defaults the new template does not use', () => {
    const data = {
      template: 'New',
      title: 'kept — new schema has it',
      items: ['Items 1', 'Items 2', 'Items 3'],
      speed: 4,
    }
    expect(stalePlaceholderFields(oldSchema, newSchema, data)).toEqual(['items', 'speed'])
  })

  it('keeps edited content and fields unknown to the old schema', () => {
    const data = {
      template: 'New',
      items: ['Real', 'Content'],
      speed: 9,
      legacy: 'from an even older template',
    }
    expect(stalePlaceholderFields(oldSchema, newSchema, data)).toEqual([])
  })

  it('keeps everything when either schema is missing or non-object', () => {
    const data = { template: 'New', items: ['Items 1', 'Items 2', 'Items 3'] }
    expect(stalePlaceholderFields(undefined, newSchema, data)).toEqual([])
    expect(stalePlaceholderFields(oldSchema, undefined, data)).toEqual([])
  })
})
