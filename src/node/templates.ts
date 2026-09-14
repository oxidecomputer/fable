import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TemplateMap } from '../model'
import { templateModule } from '../templates/validation'
import type { Theme } from '../theme'

type LoadModule = (filename: string) => Promise<Record<string, any>>

/** Shared discovery for the Vite entry and MCP's evaluated file templates. */
export async function discoverTemplates(userRoot: string, templatesDir = 'templates') {
  const directory = path.join(userRoot, templatesDir)
  let files: string[]
  try {
    files = await fs.readdir(directory)
  } catch (err: any) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const names = new Set<string>()
  return files
    .filter((file) => /\.(jsx|tsx)$/.test(file))
    .sort()
    .map((file) => {
      const name = file.replace(/\.(jsx|tsx)$/, '')
      if (names.has(name)) throw new Error(`Duplicate file template "${name}"`)
      names.add(name)
      return { name, filename: path.join(directory, file) }
    })
}

export async function loadFileTemplates(
  userRoot: string,
  loadModule: LoadModule,
): Promise<TemplateMap> {
  const entries = await discoverTemplates(userRoot)
  return Object.fromEntries(
    await Promise.all(
      entries.map(async ({ name, filename }) => {
        const [module, source] = await Promise.all([
          loadModule(filename),
          fs.readFile(filename, 'utf8'),
        ])
        return [name, { ...templateModule(module), source, example: module.example }]
      }),
    ),
  )
}

export async function resolveThemeEntry(name = 'oxcon26'): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Unknown FABLE_THEME "${name}"`)
  const filename = fileURLToPath(new URL(`../themes/${name}/index.ts`, import.meta.url))
  try {
    await fs.access(filename)
  } catch {
    throw new Error(`Unknown FABLE_THEME "${name}" (no ${filename})`)
  }
  return filename
}

export async function loadTheme(name: string, loadModule: LoadModule): Promise<Theme> {
  return (await loadModule(await resolveThemeEntry(name))).default
}
