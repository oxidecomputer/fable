import { z } from 'zod'

import { LONG_FORM_FIELDS } from '../content/long-form'
import StringArrayField from './fields/StringArrayField'
import TextInput from './fields/TextInput'
import Textarea from './fields/Textarea'

type Props = {
  schema: z.ZodTypeAny | undefined
  value: Record<string, any>
  onChange: (key: string, next: any) => void
  errorKeys: Set<string>
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: any = schema
  while (s?._def?.typeName === 'ZodEffects') s = s._def.schema
  return s
}

function isOptional(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodNullable
}

function inner(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: any = schema
  while (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
    s = s._def.innerType
  }
  return s
}

function labelFor(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function SchemaForm({ schema, value, onChange, errorKeys }: Props) {
  if (!schema) {
    return (
      <div className="text-xs text-neutral-500 italic">
        Template has no schema — fields cannot be inferred.
      </div>
    )
  }

  const unwrapped = unwrap(schema)
  if (!(unwrapped instanceof z.ZodObject)) {
    return (
      <div className="text-xs text-neutral-500 italic">
        Schema is not an object — unsupported.
      </div>
    )
  }

  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>

  return (
    <div>
      {Object.entries(shape).map(([key, fieldSchema]) => {
        const core = inner(fieldSchema)
        const hasError = errorKeys.has(key)
        const label = labelFor(key) + (isOptional(fieldSchema) ? '' : ' *')

        if (core instanceof z.ZodArray && core.element instanceof z.ZodString) {
          return (
            <StringArrayField
              key={key}
              label={label}
              value={value[key] ?? []}
              onChange={(next) => onChange(key, next)}
            />
          )
        }

        if (core instanceof z.ZodString) {
          if (LONG_FORM_FIELDS.has(key)) {
            return (
              <Textarea
                key={key}
                label={label}
                value={value[key] ?? ''}
                onChange={(next) => onChange(key, next)}
                hasError={hasError}
                monospace={key === 'diagram'}
                rows={key === 'diagram' ? 14 : 8}
              />
            )
          }
          return (
            <TextInput
              key={key}
              label={label}
              value={value[key] ?? ''}
              onChange={(next) => onChange(key, next)}
              hasError={hasError}
            />
          )
        }

        return (
          <div key={key} className="text-xs text-neutral-500 italic mb-3">
            Unsupported field type for <code>{key}</code>
          </div>
        )
      })}
    </div>
  )
}
