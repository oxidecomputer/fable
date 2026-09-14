import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'

import fable from '../plugin'
import { discoverTemplates, resolveThemeEntry } from './templates'

it('loads an external file template with shared React/Zod and preserves its source', async () => {
  const userRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fable-templates-'))
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', '')
  const source = `import { imageField, useStage } from '@oxide/fable'
import { z } from 'zod'
export const Schema = z.object({ image: imageField() })
export default function Template() { return <div>{useStage().mode}</div> }
`
  const server = await createServer({
    configFile: false,
    root: path.join(packageRoot, 'runtime'),
    publicDir: false,
    logLevel: 'silent',
    plugins: [fable({ userRoot })],
    server: { middlewareMode: true },
  })
  try {
    expect(await discoverTemplates(userRoot)).toEqual([])
    await fs.mkdir(path.join(userRoot, 'templates'))
    await fs.writeFile(path.join(userRoot, 'templates', 'Custom.tsx'), source)
    const { loadFileTemplates } = await server.ssrLoadModule(
      path.join(packageRoot, 'src/node/templates.ts'),
    )
    const files = await loadFileTemplates(userRoot, (filename: string) =>
      server.ssrLoadModule(filename),
    )
    expect(files.Custom.source).toBe(source)
    expect(typeof files.Custom.Template).toBe('function')
    expect(files.Custom.Schema.safeParse({ image: 'fable:file-id' }).success).toBe(true)

    await fs.writeFile(path.join(userRoot, 'templates', 'Custom.jsx'), source)
    await expect(discoverTemplates(userRoot)).rejects.toThrow('Duplicate file template')
  } finally {
    await server.close()
    await fs.rm(userRoot, { recursive: true, force: true })
    vi.unstubAllEnvs()
  }
}, 15_000)

it('rejects an unknown theme consistently instead of silently selecting another', async () => {
  await expect(resolveThemeEntry('missing-theme')).rejects.toThrow('Unknown FABLE_THEME')
})
