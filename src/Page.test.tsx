// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

import Page from './Page'

it('recovers from a render error when only the live template changes', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const element = document.createElement('div')
  const root = createRoot(element)
  const data = { template: 'Custom' }
  const previousActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  try {
    act(() =>
      root.render(
        <Page
          data={data}
          scale={1}
          pageNumber={null}
          templates={{
            Custom: {
              Template: () => {
                throw new Error('Broken layout')
              },
            },
          }}
        />,
      ),
    )
    expect(element.textContent).toContain('Broken layout')
    act(() =>
      root.render(
        <Page
          data={data}
          scale={1}
          pageNumber={null}
          templates={{ Custom: { Template: () => <div>Repaired layout</div> } }}
        />,
      ),
    )
    expect(element.textContent).toContain('Repaired layout')
    expect(element.textContent).not.toContain('Broken layout')
  } finally {
    act(() => root.unmount())
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
    log.mockRestore()
  }
})
