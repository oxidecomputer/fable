import YAML from 'yaml'

import { LONG_FORM_FIELDS } from './long-form'

export type PageData = Record<string, any> & { template: string }

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const DIRECTIVE_OPEN_RE = /^:::\s+(\S+)\s*$/
const DIRECTIVE_CLOSE_RE = /^:::\s*$/

export function parsePage(text: string): PageData {
  const m = text.match(FRONTMATTER_RE)
  if (!m) throw new Error('Page is missing YAML frontmatter (--- ... ---)')
  const frontmatter = YAML.parse(m[1]) ?? {}
  const body = m[2].replace(/^\r?\n+/, '').replace(/\r?\n+$/, '')

  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('Frontmatter must be a YAML object')
  }

  const lines = body.split(/\r?\n/)
  const hasDirectives = lines.some((l) => DIRECTIVE_OPEN_RE.test(l))
  const bodyFields: Record<string, string> = {}

  if (hasDirectives) {
    let currentName: string | null = null
    let buf: string[] = []
    for (const line of lines) {
      const open = line.match(DIRECTIVE_OPEN_RE)
      if (open && currentName === null) {
        currentName = open[1]
        buf = []
        continue
      }
      if (DIRECTIVE_CLOSE_RE.test(line) && currentName !== null) {
        bodyFields[currentName] = buf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
        currentName = null
        buf = []
        continue
      }
      if (currentName !== null) buf.push(line)
    }
    if (currentName !== null) {
      throw new Error(`Unclosed ::: ${currentName} block`)
    }
  } else if (body.length > 0) {
    bodyFields.text = body
  }

  return { ...frontmatter, ...bodyFields }
}

export function serializePage(data: PageData): string {
  const { template, custom_template, ...rest } = data
  const longFormKeys = Object.keys(rest).filter(
    (k) => LONG_FORM_FIELDS.has(k) && typeof rest[k] === 'string',
  )

  const useSingleBody = longFormKeys.length === 1 && longFormKeys[0] === 'text'

  const frontmatter: Record<string, any> = { template }
  if (custom_template !== undefined) frontmatter.custom_template = custom_template
  for (const [k, v] of Object.entries(rest)) {
    if (useSingleBody && k === 'text') continue
    if (!useSingleBody && longFormKeys.includes(k)) continue
    frontmatter[k] = v
  }

  const yamlText = YAML.stringify(frontmatter, { lineWidth: 0 }).replace(/\n$/, '')
  let body = ''
  if (useSingleBody) {
    body = String(rest.text ?? '')
  } else if (longFormKeys.length > 0) {
    body = longFormKeys.map((k) => `::: ${k}\n${String(rest[k] ?? '')}\n:::`).join('\n\n')
  }

  return `---\n${yamlText}\n---\n${body ? `\n${body}\n` : ''}`
}
