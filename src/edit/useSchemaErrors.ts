import { useMemo } from 'react'
import { z } from 'zod'

import type { TemplateModule } from '../Page'

export function useSchemaErrors(
  template: TemplateModule | undefined,
  data: any,
): z.ZodIssue[] | null {
  return useMemo<z.ZodIssue[] | null>(() => {
    if (!template?.Schema) return null
    const { template: _t, custom_template: _ct, ...rest } = data
    const schema =
      template.Schema instanceof z.ZodObject ? template.Schema.strict() : template.Schema
    const parsed = schema.safeParse(rest)
    return parsed.success ? null : parsed.error.issues
  }, [template, data])
}
