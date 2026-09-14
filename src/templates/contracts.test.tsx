// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createTemplateCompiler } from '../collab/compile'
import { parsePage } from '../content/markdown'
import { PageInfoContext, StageContext } from '../stage'
import oxcon26 from '../themes/oxcon26'
import { validatePageFields } from './validation'

for (const theme of [oxcon26]) {
  describe(`${theme.name} template forks`, () => {
    const compiler = createTemplateCompiler(theme.templateExports)
    for (const [name, original] of Object.entries(theme.templates)) {
      it(`${name}: canonical source validates and renders identically after forking`, () => {
        expect(original.source).toBeTruthy()
        expect(original.example).toBeTruthy()
        const data = parsePage(original.example!)
        const fork = compiler.compile(original.source!)
        expect(validatePageFields(original, data)).toEqual([])
        expect(validatePageFields(fork, data)).toEqual([])

        const render = (Template: typeof original.Template) =>
          renderToStaticMarkup(
            <StageContext.Provider value={{ mode: 'thumbnail', scale: 1 }}>
              <PageInfoContext.Provider value={{ number: 2, total: 5 }}>
                <Template data={data} />
              </PageInfoContext.Provider>
            </StageContext.Provider>,
          )
        expect(render(fork.Template)).toBe(render(original.Template))
      })
    }
  })
}
