import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
} from '@codemirror/autocomplete'
import { z } from 'zod'

import { describeSchema } from '../../collab/schema-info'
import { LONG_FORM_FIELDS } from '../../content/long-form'
import type { TemplateMap } from '../../model'
import { unwrapEffects } from '../../templates/validation'

export type Suggestion = { from: number; options: Completion[] }

/** Peel wrappers that don't change what value the author types. */
function unwrapField(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: any = schema
  for (;;) {
    if (
      s instanceof z.ZodOptional ||
      s instanceof z.ZodNullable ||
      s instanceof z.ZodDefault
    ) {
      s = s._def.innerType
    } else if (s instanceof z.ZodEffects) {
      s = s._def.schema
    } else {
      return s
    }
  }
}

function objectShape(
  schema: z.ZodTypeAny | undefined,
): Record<string, z.ZodTypeAny> | null {
  const s = unwrapEffects(schema)
  return s instanceof z.ZodObject ? (s.shape as Record<string, z.ZodTypeAny>) : null
}

const KEY_RE = /^([\w-]*)$/
const VALUE_RE = /^([\w-]+):\s+([\w-]*)$/
const NESTED_KEY_RE = /^\s+(?:-\s*)?([\w-]*)$/
const TOP_KEY_RE = /^([\w-]+):/
const DIRECTIVE_RE = /^:::\s*([\w-]*)$/

/**
 * Schema-driven completions for a full page source (frontmatter + body).
 * Pure over (text, pos) so the policy is testable without an editor; returns
 * the replaced-from offset and the options, or null when nothing applies.
 */
export function suggestAt(
  text: string,
  pos: number,
  templates: TemplateMap,
): Suggestion | null {
  const lines = text.split('\n')

  // Locate the cursor's line and the frontmatter block (lines between the
  // opening `---` and the closing `---`, tolerant of a still-unclosed block).
  let offset = 0
  let lineIndex = 0
  for (; lineIndex < lines.length; lineIndex++) {
    const end = offset + lines[lineIndex].length
    if (pos <= end) break
    offset = end + 1
  }
  if (lineIndex >= lines.length) return null
  const before = lines[lineIndex].slice(0, pos - offset)

  const hasFrontmatter = lines[0]?.trimEnd() === '---'
  let fmEnd = -1 // line index of the closing `---`
  if (hasFrontmatter) {
    fmEnd = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---')
    if (fmEnd === -1) fmEnd = lines.length
  }
  const inFrontmatter = hasFrontmatter && lineIndex > 0 && lineIndex < fmEnd
  const fmLines = hasFrontmatter ? lines.slice(1, fmEnd) : []

  const templateName = fmLines
    .map((l) => l.match(/^template:\s*(.*?)\s*$/)?.[1])
    .find((n) => n)
  const schema = templateName ? templates[templateName]?.Schema : undefined
  const shape = objectShape(schema)
  const details = describeSchema(schema)

  if (inFrontmatter) {
    // Value position: `key: <partial>`
    const valueMatch = before.match(VALUE_RE)
    if (valueMatch) {
      const [, key, partial] = valueMatch
      const from = pos - partial.length
      if (key === 'template') {
        return {
          from,
          options: Object.entries(templates).map(([name, mod]) => ({
            label: name,
            type: 'class',
            detail: mod.description,
          })),
        }
      }
      const field = shape?.[key]
      if (!field) return null
      const core = unwrapField(field)
      if (core instanceof z.ZodEnum) {
        return {
          from,
          options: (core.options as string[]).map((label) => ({
            label,
            type: 'enum',
          })),
        }
      }
      if (core instanceof z.ZodBoolean) {
        return {
          from,
          options: [
            { label: 'true', type: 'keyword' },
            { label: 'false', type: 'keyword' },
          ],
        }
      }
      return null
    }

    // Top-level key position (an unindented bare word).
    const keyMatch = before.match(KEY_RE)
    if (keyMatch) {
      const from = pos - keyMatch[1].length
      const present = new Set(
        fmLines
          .filter((_, i) => i + 1 !== lineIndex)
          .map((l) => l.match(TOP_KEY_RE)?.[1])
          .filter((k): k is string => !!k),
      )
      const options: Completion[] = []
      if (!present.has('template')) {
        options.push({
          label: 'template',
          type: 'property',
          apply: 'template: ',
          boost: 1,
        })
      }
      for (const key of Object.keys(shape ?? {})) {
        // Long-form fields belong in the body as `::: field` blocks.
        if (present.has(key) || LONG_FORM_FIELDS.has(key)) continue
        options.push({
          label: key,
          type: 'property',
          apply: `${key}: `,
          detail: details[key],
        })
      }
      return options.length ? { from, options } : null
    }

    // Nested key inside an array-of-objects field (`- key:` items).
    const nestedMatch = before.match(NESTED_KEY_RE)
    if (nestedMatch && shape) {
      let parent: string | undefined
      for (let i = lineIndex - 1; i >= 1; i--) {
        const m = lines[i].match(TOP_KEY_RE)
        if (m) {
          parent = m[1]
          break
        }
      }
      const core = parent && shape[parent] ? unwrapField(shape[parent]) : undefined
      if (core instanceof z.ZodArray) {
        const element = unwrapField(core.element)
        if (element instanceof z.ZodObject) {
          return {
            from: pos - nestedMatch[1].length,
            options: Object.keys(element.shape).map((key) => ({
              label: key,
              type: 'property',
              apply: `${key}: `,
            })),
          }
        }
      }
      return null
    }
    return null
  }

  // Body: complete the field name of a `::: field` directive.
  if (hasFrontmatter && lineIndex > fmEnd) {
    const directiveMatch = before.match(DIRECTIVE_RE)
    if (!directiveMatch) return null
    const used = new Set(
      lines
        .slice(fmEnd + 1)
        .filter((_, i) => fmEnd + 1 + i !== lineIndex)
        .map((l) => l.match(/^:::\s+([\w-]+)/)?.[1]),
    )
    const candidates = shape
      ? Object.keys(shape).filter((k) => LONG_FORM_FIELDS.has(k))
      : [...LONG_FORM_FIELDS]
    const options = candidates
      .filter((k) => !used.has(k))
      .map((key) => ({
        label: key,
        type: 'property' as const,
        detail: details[key],
      }))
    return options.length ? { from: pos - directiveMatch[1].length, options } : null
  }

  return null
}

/**
 * Autocomplete for the raw page-source editor: frontmatter keys and values
 * come from the current template's Zod schema (`getTemplates` is read lazily
 * so doc/file template changes apply without rebuilding the extension).
 */
export function pageCompletion(getTemplates: () => TemplateMap) {
  return autocompletion({
    icons: false,
    override: [
      (context: CompletionContext): CompletionResult | null => {
        const suggestion = suggestAt(
          context.state.doc.toString(),
          context.pos,
          getTemplates(),
        )
        if (!suggestion) return null
        if (suggestion.from === context.pos && !context.explicit) return null
        return { ...suggestion, validFor: /^[\w-]*$/ }
      },
    ],
  })
}
