import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { TemplateMap } from '../../model'
import { suggestAt } from './page-completion'

const Noop = () => null as any

const templates: TemplateMap = {
  Basic: {
    Template: Noop,
    description: 'A basic slide',
    Schema: z.object({
      title: z.string(),
      variant: z.enum(['dark', 'light']).optional(),
      footer: z.boolean().optional(),
      rows: z.array(z.object({ stat: z.string(), label: z.string() })).optional(),
      text: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Title: { Template: Noop, description: 'Just a title' },
}

const labels = (s: ReturnType<typeof suggestAt>) => s?.options.map((o) => o.label)

function at(source: string): { text: string; pos: number } {
  const pos = source.indexOf('|')
  return { text: source.slice(0, pos) + source.slice(pos + 1), pos }
}

describe('suggestAt', () => {
  it('completes template names after template:', () => {
    const { text, pos } = at('---\ntemplate: B|\n---\n')
    const s = suggestAt(text, pos, templates)
    expect(labels(s)).toEqual(['Basic', 'Title'])
    expect(s!.from).toBe(pos - 1)
    expect(s!.options[0].detail).toBe('A basic slide')
  })

  it('completes schema field keys, excluding present and long-form fields', () => {
    const { text, pos } = at('---\ntemplate: Basic\ntitle: Hi\nv|\n---\n')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['variant', 'footer', 'rows'])
  })

  it('offers template first in an empty frontmatter', () => {
    const { text, pos } = at('---\n|\n---\n')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['template'])
  })

  it('completes enum values', () => {
    const { text, pos } = at('---\ntemplate: Basic\nvariant: |\n---\n')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['dark', 'light'])
  })

  it('completes boolean values', () => {
    const { text, pos } = at('---\ntemplate: Basic\nfooter: t|\n---\n')
    const s = suggestAt(text, pos, templates)
    expect(labels(s)).toEqual(['true', 'false'])
    expect(s!.from).toBe(pos - 1)
  })

  it('offers nothing for free-string values', () => {
    const { text, pos } = at('---\ntemplate: Basic\ntitle: H|\n---\n')
    expect(suggestAt(text, pos, templates)).toBeNull()
  })

  it('completes nested keys inside array-of-object items', () => {
    const { text, pos } = at('---\ntemplate: Basic\nrows:\n  - s|\n---\n')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['stat', 'label'])
  })

  it('completes long-form field names in ::: directives, excluding used ones', () => {
    const { text, pos } = at('---\ntemplate: Basic\n---\n::: text\nBody\n:::\n\n::: n|\n')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['notes'])
  })

  it('ignores the frontmatter delimiters and unknown templates', () => {
    const fence = at('---\ntemplate: Basic\n--|-\n')
    expect(suggestAt(fence.text, fence.pos, templates)).toBeNull()
    const unknown = at('---\ntemplate: Nope\nvariant: |\n---\n')
    expect(suggestAt(unknown.text, unknown.pos, templates)).toBeNull()
  })

  it('works while the frontmatter is still unclosed', () => {
    const { text, pos } = at('---\ntemplate: Basic\nvariant: d|')
    expect(labels(suggestAt(text, pos, templates))).toEqual(['dark', 'light'])
  })
})
