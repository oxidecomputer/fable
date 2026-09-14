import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { fieldMeta, imageField, imageFieldKeys, markdownField } from './fields'

describe('field metadata', () => {
  it('marks image and markdown fields', () => {
    expect(fieldMeta(imageField())).toEqual({ kind: 'image' })
    expect(fieldMeta(markdownField())).toEqual({ kind: 'markdown', images: false })
    expect(fieldMeta(markdownField({ images: true }))).toEqual({
      kind: 'markdown',
      images: true,
    })
    expect(fieldMeta(z.string())).toBeUndefined()
  })

  it('survives optional/nullable/default wrappers', () => {
    expect(fieldMeta(imageField().optional())?.kind).toBe('image')
    expect(fieldMeta(imageField().nullable().optional())?.kind).toBe('image')
    expect(fieldMeta(imageField().default('/x.png'))?.kind).toBe('image')
  })

  it('still validates as a plain string', () => {
    expect(imageField().safeParse('fable:fl_abc').success).toBe(true)
    expect(imageField().safeParse(3).success).toBe(false)
  })

  it('lists image field keys of an object schema', () => {
    const schema = z
      .object({
        title: z.string(),
        image: imageField(),
        logo: imageField().optional(),
      })
      .refine(() => true)
    expect(imageFieldKeys(schema)).toEqual(['image', 'logo'])
    expect(imageFieldKeys(z.string())).toEqual([])
    expect(imageFieldKeys(undefined)).toEqual([])
  })
})
