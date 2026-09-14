import { z } from 'zod'

import type { PageData, TemplateModule } from '../model'

/** Introspection only. Validation must preserve refinements and transforms. */
export function unwrapEffects(schema: z.ZodTypeAny | undefined): z.ZodTypeAny | undefined {
  let current = schema
  while (current instanceof z.ZodEffects) current = current.innerType()
  return current
}

/** Make the root object strict without discarding surrounding effects. */
function strictRoot(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodObject) return schema.strict()
  if (schema instanceof z.ZodEffects) {
    return new z.ZodEffects({ ...schema._def, schema: strictRoot(schema.innerType()) })
  }
  return schema
}

export function validatePageFields(
  template: TemplateModule | undefined,
  data: PageData,
): z.ZodIssue[] {
  if (!template?.Schema) return []
  const { template: _template, custom_template: _customTemplate, ...fields } = data
  const result = strictRoot(template.Schema).safeParse(fields)
  return result.success ? [] : result.error.issues
}

/** Check the evaluated module contract; this does not render its component. */
export function templateModule(exports: Record<string, any>): TemplateModule {
  const Template = exports.Template ?? exports.default
  if (typeof Template !== 'function') {
    throw new Error('Template module must export a `Template` function')
  }
  if (exports.Schema !== undefined && !(exports.Schema instanceof z.ZodType)) {
    throw new Error('Template module `Schema` must be a Zod schema')
  }
  return {
    Template,
    ...(exports.Schema ? { Schema: exports.Schema } : {}),
    ...(typeof exports.description === 'string'
      ? { description: exports.description }
      : {}),
  }
}
