import { transform } from 'sucrase'

/** Syntax-only TSX → CJS. Does not evaluate template code or load its imports. */
export function transpileTemplate(source: string): string {
  return transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  }).code
}
