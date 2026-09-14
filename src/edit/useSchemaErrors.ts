import { useMemo } from 'react'
import { z } from 'zod'

import type { PageData, TemplateModule } from '../model'
import { validatePageFields } from '../templates/validation'

export function useSchemaErrors(
  template: TemplateModule | undefined,
  data: PageData,
): z.ZodIssue[] | null {
  return useMemo<z.ZodIssue[] | null>(() => {
    const issues = validatePageFields(template, data)
    return issues.length ? issues : null
  }, [template, data])
}
