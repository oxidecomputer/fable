import { atom } from '@tldraw/state'

/** Names of doc-stored custom templates (sorted). */
export const $docTemplateNames = atom<string[]>('docTemplateNames', [])

/** Compile errors for doc-stored templates, keyed by template name. */
export const $docTemplateErrors = atom<Record<string, string>>('docTemplateErrors', {})
