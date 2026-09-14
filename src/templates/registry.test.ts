import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { compileTemplate } from '../collab/compile'
import { resolveTemplates } from './registry'
import { validatePageFields } from './validation'

const THEME = `import { z } from 'zod'
export const Schema = z.object({ title: z.string() })
export function Template() { return <div>Theme</div> }
`
const FILE = THEME.replace('title:', 'subtitle:').replace('Theme', 'File')
const DOCUMENT = THEME.replace('title:', 'description:').replace('Theme', 'Document')

describe('template resolution', () => {
  it('uses the same active source and schema for theme, file, and document overrides', () => {
    const theme = { Layout: compileTemplate(THEME) }
    const files = { Layout: compileTemplate(FILE) }
    const fileRegistry = resolveTemplates({ theme, files })
    expect(fileRegistry.origins.Layout).toBe('file')
    expect(fileRegistry.templates.Layout.source).toBe(FILE)
    expect(
      validatePageFields(fileRegistry.templates.Layout, {
        template: 'Layout',
        subtitle: 'File field',
      }),
    ).toEqual([])

    const docRegistry = resolveTemplates({ theme, files, document: { Layout: DOCUMENT } })
    expect(docRegistry.origins.Layout).toBe('document')
    expect(docRegistry.templates.Layout.source).toBe(DOCUMENT)
    expect(
      validatePageFields(docRegistry.templates.Layout, {
        template: 'Layout',
        subtitle: 'Wrong field for this override',
      }),
    ).not.toEqual([])
    expect(resolveTemplates({ theme }).templates.Layout.source).toBe(THEME)
  })

  it('reports a broken document override without falling through to the base layout', () => {
    const result = resolveTemplates({
      theme: { Layout: compileTemplate(THEME) },
      document: { Layout: 'export const {' },
    })
    expect(result.origins.Layout).toBe('document')
    expect(result.errors.Layout).toBeTruthy()
    expect(result.templates.Layout).toBeUndefined()
  })
})

describe('field validation', () => {
  it('keeps refinements and transforms while rejecting unknown root fields', () => {
    const template = {
      Template: () => null as any,
      Schema: z
        .object({ title: z.string() })
        .transform(({ title }) => title.length)
        .refine((length) => length >= 3, 'Title too short'),
    }
    expect(validatePageFields(template, { template: 'Layout', title: 'Good' })).toEqual([])
    expect(validatePageFields(template, { template: 'Layout', title: 'X' })).toEqual([
      expect.objectContaining({ message: 'Title too short' }),
    ])
    expect(
      validatePageFields(template, { template: 'Layout', title: 'Good', typo: 'Oops' }),
    ).toEqual([expect.objectContaining({ code: 'unrecognized_keys' })])
  })
})
