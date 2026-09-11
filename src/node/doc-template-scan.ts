import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Doc-stored templates live in the room and compile in the browser, so
 * Tailwind's source scanning never sees them and their utility classes would
 * be missing from the generated CSS. Mirroring their sources into a
 * gitignored scratch dir (added as an `@source` by the plugin) closes the
 * gap: the dev server, the MCP server, and builds all sync it.
 */

export function docTemplateScratchDir(userRoot: string): string {
  return path.join(userRoot, '.fable', 'doc-templates')
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_')
}

function scratchFilename(name: string): string {
  return `${safeName(name)}.tsx`
}

/**
 * Mirror one deck's template sources into its scratch subdir
 * (adds/updates/removes within that deck only — decks are independent).
 */
export async function syncDocTemplateScratch(
  userRoot: string,
  deckId: string,
  templates: Record<string, string>,
): Promise<void> {
  const dir = path.join(docTemplateScratchDir(userRoot), safeName(deckId))
  await fs.mkdir(dir, { recursive: true })

  const keep = new Set(Object.keys(templates).map(scratchFilename))
  for (const [name, source] of Object.entries(templates)) {
    const file = path.join(dir, scratchFilename(name))
    const existing = await fs.readFile(file, 'utf8').catch(() => null)
    if (existing !== source) await fs.writeFile(file, source, 'utf8')
  }

  const files = await fs.readdir(dir).catch(() => [] as string[])
  for (const f of files) {
    if (f.endsWith('.tsx') && !keep.has(f)) {
      await fs.unlink(path.join(dir, f)).catch(() => {})
    }
  }
}
