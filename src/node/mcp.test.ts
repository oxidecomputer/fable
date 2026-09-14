import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { compileTemplate } from '../collab/compile'
import { readTemplateSources, seedDoc } from '../collab/doc'
import { createDocTemplate, listSlides, readSlide } from '../collab/ops'
import { createMcpServer } from './mcp'

const api = vi.hoisted(() => ({
  getYjsDocumentAsBinaryUpdate: vi.fn(),
  sendYjsBinaryUpdate: vi.fn(),
  fetchDocTemplateSources: vi.fn(),
}))
vi.mock('./collab', () => ({
  createLiveblocks: () => api,
  ensureRoom: vi.fn(),
  fetchDocTemplateSources: api.fetchDocTemplateSources,
  uploadRoomFile: vi.fn(),
}))
vi.mock('./doc-template-scan', () => ({ syncDocTemplateScratch: vi.fn() }))

const THEME = `import { z } from 'zod'
export const Schema = z.object({ title: z.string() })
export function Template() { return <div>Theme</div> }
`
const FILE = THEME.replace('title:', 'subtitle:').replace('Theme', 'File')
const DOCUMENT = THEME.replace('title:', 'description:').replace('Theme', 'Document')

let room: Y.Doc
let client: Client
let handle: Awaited<ReturnType<typeof createMcpServer>>
let pageId: string

beforeEach(async () => {
  room = new Y.Doc()
  seedDoc(room, { pages: [{ template: 'Layout', subtitle: 'Original' }] }, ['slide.md'])
  pageId = listSlides(room).slides[0].pageId
  api.getYjsDocumentAsBinaryUpdate.mockImplementation(async () =>
    Y.encodeStateAsUpdate(room),
  )
  api.sendYjsBinaryUpdate.mockImplementation(async (_deck, update) =>
    Y.applyUpdate(room, update),
  )
  api.fetchDocTemplateSources.mockImplementation(async () => readTemplateSources(room))
  handle = await createMcpServer({
    secret: 'test',
    defaultDeck: 'test-deck',
    userRoot: '/unused',
    theme: {
      name: 'test',
      templates: { Layout: compileTemplate(THEME) },
      templateExports: { themeLabel: 'Theme runtime' },
    },
    loadFileTemplates: async () => ({ Layout: compileTemplate(FILE) }),
  })
  client = new Client({ name: 'test', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await handle.server.connect(serverTransport)
  await client.connect(clientTransport)
})

afterEach(async () => {
  await client.close()
  await handle.dispose()
  room.destroy()
  vi.clearAllMocks()
})

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text?: string }>
  return { error: result.isError, text: content.map((item) => item.text ?? '').join('\n') }
}

describe('MCP template contract', () => {
  it('reads and describes the active file override, then the document override', async () => {
    expect((await call('read_template', { name: 'Layout' })).text).toBe(FILE)
    let templates = JSON.parse((await call('list_templates')).text)
    expect(templates.Layout).toMatchObject({ kind: 'file', fields: { subtitle: 'string' } })

    createDocTemplate(room, 'Layout', DOCUMENT)
    expect((await call('read_template', { name: 'Layout' })).text).toBe(DOCUMENT)
    templates = JSON.parse((await call('list_templates')).text)
    expect(templates.Layout).toMatchObject({
      kind: 'document',
      editable: true,
      fields: { description: 'markdown string' },
    })
  })

  it('uses file and document schemas for slide warnings while saving valid source', async () => {
    let result = await call('update_slide', {
      pageId,
      source: '---\ntemplate: Layout\nsubtitle: Updated\n---\n',
    })
    expect(result.error).toBeFalsy()
    expect(result.text).not.toContain('warnings')
    expect(readSlide(room, pageId)).toContain('subtitle: Updated')

    createDocTemplate(room, 'Layout', DOCUMENT)
    result = await call('update_slide', {
      pageId,
      source: '---\ntemplate: Layout\nsubtitle: Wrong field\n---\n',
    })
    expect(result.error).toBeFalsy()
    expect(result.text).toContain('Schema warnings')
    expect(result.text).toContain('description')
  })

  it('keeps a broken document override readable and reports its compile error', async () => {
    createDocTemplate(room, 'Layout', 'export const {')
    expect((await call('read_template', { name: 'Layout' })).text).toBe('export const {')
    const templates = JSON.parse((await call('list_templates')).text)
    expect(templates.Layout.kind).toBe('document')
    expect(templates.Layout.error).toBeTruthy()
  })

  it('validates agent template submissions before any document write', async () => {
    const result = await call('create_template', {
      name: 'Broken',
      source: 'export const {',
    })
    expect(result.error).toBe(true)
    expect(result.text).toContain('Template evaluation failed')
    expect(readTemplateSources(room)).toEqual({})
    expect(api.sendYjsBinaryUpdate).not.toHaveBeenCalled()
  })

  it('evaluates agent templates using the selected theme runtime', async () => {
    const source = `import { themeLabel } from '@oxide/fable'
      if (themeLabel !== 'Theme runtime') throw new Error('Missing theme runtime')
      export function Template() { return <div>{themeLabel}</div> }`
    const result = await call('create_template', { name: 'Custom', source })
    expect(result.error).toBeFalsy()
    expect(readTemplateSources(room).Custom).toBe(source)
  })
})
