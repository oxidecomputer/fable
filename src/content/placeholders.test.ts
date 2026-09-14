import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { missingFieldPlaceholders } from './placeholders'

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
    })
    const patch = missingFieldPlaceholders(schema, { title: 'kept' })
    expect(patch).toEqual({
      count: 1,
      kind: 'spark',
      items: ['Items 1', 'Items 2', 'Items 3'],
      people: [{ name: 'Name' }, { name: 'Name' }, { name: 'Name' }],
      flag: false,
      speed: 4,
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
