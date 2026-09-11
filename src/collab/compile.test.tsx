// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { compileTemplate } from './compile'

describe('compileTemplate', () => {
  it('compiles a TSX module with Schema + Template', () => {
    const mod = compileTemplate(`
import { z } from 'zod'
import { Markdown } from '@oxide/fable'

export const Schema = z.object({ title: z.string(), text: z.string().optional() })

export function Template({ data }: { data: any }) {
  return (
    <div className="page-padding">
      <h1>{data.title}</h1>
      {data.text && <Markdown content={data.text} />}
    </div>
  )
}
`)
    expect(mod.Schema).toBeTruthy()
    expect(mod.Schema!.safeParse({ title: 'hi' }).success).toBe(true)
    const html = renderToStaticMarkup(
      <mod.Template data={{ title: 'Hello', text: 'some *markdown*' }} />,
    )
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('<em>markdown</em>')
  })

  it('supports react hooks imports', () => {
    const mod = compileTemplate(`
import { useMemo } from 'react'
export function Template({ data }) {
  const upper = useMemo(() => String(data.title).toUpperCase(), [data.title])
  return <div>{upper}</div>
}
`)
    const html = renderToStaticMarkup(<mod.Template data={{ title: 'abc' }} />)
    expect(html).toContain('ABC')
  })

  it('rejects unknown imports', () => {
    expect(() =>
      // The import must be referenced — sucrase elides unused imports.
      compileTemplate(
        `import fs from 'node:fs'\nexport function Template() { return <div>{fs.sep}</div> }`,
      ),
    ).toThrow(/not available/)
  })

  it('throws on syntax errors', () => {
    expect(() => compileTemplate('export function Template({')).toThrow()
  })

  it('requires a Template export', () => {
    expect(() => compileTemplate('export const x = 1')).toThrow(/Template/)
  })
})
