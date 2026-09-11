import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

import type { DeckContent } from '../collab/doc'
import { type PageData, parsePage, serializePage } from '../content/markdown'

export type LoadedDeck = {
  content: DeckContent
  filenames: string[]
  files: string[]
  /** Liveblocks room id from deck.yml's `room:` key, if any. */
  room?: string
}

export async function loadDeck(rootDir: string): Promise<LoadedDeck> {
  const deckYmlPath = path.join(rootDir, 'content', 'deck.yml')
  const deckYml = await fs.readFile(deckYmlPath, 'utf8')
  const deck = YAML.parse(deckYml) ?? {}

  const filenames: string[] = Array.isArray(deck.pages) ? deck.pages : []
  const files: string[] = [deckYmlPath]
  const pages: PageData[] = []

  for (const fname of filenames) {
    const filePath = path.join(rootDir, 'content', fname)
    files.push(filePath)
    const text = await fs.readFile(filePath, 'utf8')
    try {
      pages.push(parsePage(text))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to parse ${fname}: ${msg}`)
    }
  }

  const content: DeckContent = { pages }
  if (typeof deck.title === 'string') content.title = deck.title
  if (deck.config) content.config = deck.config
  const result: LoadedDeck = { content, filenames, files }
  if (typeof deck.room === 'string') result.room = deck.room
  return result
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)
}

/** Write raw page sources + deck.yml (used by `fable pull` — sources are verbatim). */
export async function writeDeckFiles(
  rootDir: string,
  deck: {
    meta: { title?: string; config?: { page_numbers?: boolean } }
    filenames: string[]
    sources: string[]
    room?: string
  },
): Promise<void> {
  const contentDir = path.join(rootDir, 'content')
  await fs.mkdir(contentDir, { recursive: true })
  for (let i = 0; i < deck.sources.length; i++) {
    await writeAtomic(path.join(contentDir, deck.filenames[i]), deck.sources[i])
  }
  const deckPayload: Record<string, any> = {}
  if (deck.meta.title) deckPayload.title = deck.meta.title
  if (deck.meta.config) deckPayload.config = deck.meta.config
  if (deck.room) deckPayload.room = deck.room
  deckPayload.pages = deck.filenames
  await writeAtomic(
    path.join(contentDir, 'deck.yml'),
    YAML.stringify(deckPayload, { lineWidth: 0 }),
  )
}

export async function serializeDeck(
  rootDir: string,
  content: DeckContent,
  filenames: string[],
  extra?: { room?: string },
): Promise<void> {
  if (filenames.length !== content.pages.length) {
    throw new Error(
      `Filename count (${filenames.length}) does not match page count (${content.pages.length})`,
    )
  }
  const contentDir = path.join(rootDir, 'content')
  await fs.mkdir(contentDir, { recursive: true })
  for (let i = 0; i < content.pages.length; i++) {
    const filePath = path.join(contentDir, filenames[i])
    await writeAtomic(filePath, serializePage(content.pages[i]))
  }
  const deckPayload: Record<string, any> = {}
  if (content.title) deckPayload.title = content.title
  if (content.config) deckPayload.config = content.config
  if (extra?.room) deckPayload.room = extra.room
  deckPayload.pages = filenames
  await writeAtomic(
    path.join(contentDir, 'deck.yml'),
    YAML.stringify(deckPayload, { lineWidth: 0 }),
  )
}
