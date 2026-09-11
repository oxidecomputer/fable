import { Liveblocks } from '@liveblocks/node'
import * as Y from 'yjs'

import {
  type DeckContent,
  type ReadDeckResult,
  type ReadDeckSourcesResult,
  isDocEmpty,
  readDeck,
  readDeckSources,
  seedDoc,
} from '../collab/doc'

export type CollabUser = {
  id: string
  info?: { name?: string; color?: string; avatar?: string }
}

export function createLiveblocks(secret: string): Liveblocks {
  return new Liveblocks({ secret })
}

const USER_COLORS = [
  '#F7869B',
  '#EDD5A6',
  '#88DCB7',
  '#9DAFFA',
  '#C6A5EA',
  '#68D9A7',
  '#EFB7C2',
]

export function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

/**
 * Authorize a user for a room via Liveblocks access tokens. Returns the
 * HTTP-ish result to relay to the client.
 */
export async function authorizeUser(
  liveblocks: Liveblocks,
  roomId: string,
  user: CollabUser,
): Promise<{ status: number; body: string }> {
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.info?.name ?? user.id,
      color: user.info?.color ?? colorForUser(user.id),
      ...(user.info?.avatar ? { avatar: user.info.avatar } : {}),
    },
  })
  session.allow(roomId, session.FULL_ACCESS)
  const { status, body } = await session.authorize()
  return { status, body }
}

export async function ensureRoom(liveblocks: Liveblocks, roomId: string): Promise<void> {
  try {
    await liveblocks.createRoom(roomId, { defaultAccesses: ['room:write'] })
  } catch (err: any) {
    // 409 = room already exists, which is fine.
    if (err?.status !== 409) throw err
  }
}

async function fetchDoc(liveblocks: Liveblocks, roomId: string): Promise<Y.Doc> {
  const update = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId)
  const ydoc = new Y.Doc()
  const bytes = new Uint8Array(update)
  if (bytes.byteLength > 0) Y.applyUpdate(ydoc, bytes)
  return ydoc
}

export class RoomNotEmptyError extends Error {
  constructor(roomId: string) {
    super(`Room "${roomId}" already contains a deck — use force to overwrite`)
    this.name = 'RoomNotEmptyError'
  }
}

/**
 * Seed a room's Yjs doc from plain deck content. Refuses to overwrite a
 * non-empty doc unless `force` is set (overwrite replaces the deck wholesale
 * via a diff update against the current doc state).
 */
export async function seedRoom(
  liveblocks: Liveblocks,
  roomId: string,
  content: DeckContent,
  filenames: string[],
  opts: { force?: boolean } = {},
): Promise<void> {
  await ensureRoom(liveblocks, roomId)
  const ydoc = await fetchDoc(liveblocks, roomId)
  if (!isDocEmpty(ydoc) && !opts.force) throw new RoomNotEmptyError(roomId)

  const before = Y.encodeStateVector(ydoc)
  seedDoc(ydoc, content, filenames)
  const update = Y.encodeStateAsUpdate(ydoc, before)
  await liveblocks.sendYjsBinaryUpdate(roomId, update)
}

export type DeckSummary = {
  id: string
  title: string | null
  pageCount: number
  lastConnectionAt: string | null
}

/**
 * List decks (= rooms) with their titles and sizes. Titles live inside each
 * room's Yjs doc, so this is one REST call per room — fine for the deck
 * index at human scale.
 */
export async function listDecks(
  liveblocks: Liveblocks,
  limit = 50,
): Promise<DeckSummary[]> {
  const { data } = await liveblocks.getRooms({ limit })
  return Promise.all(
    data.map(async (room) => {
      let title: string | null = null
      let pageCount = 0
      try {
        const ydoc = await fetchDoc(liveblocks, room.id)
        const t = ydoc.getMap('meta').get('title')
        title = typeof t === 'string' ? t : null
        pageCount = ydoc.getArray('order').length
      } catch {
        /* unreadable rooms list as untitled */
      }
      return {
        id: room.id,
        title,
        pageCount,
        lastConnectionAt: room.lastConnectionAt
          ? new Date(room.lastConnectionAt).toISOString()
          : null,
      }
    }),
  )
}

/** Read a room's doc-stored template sources, keyed by template name. */
export async function fetchDocTemplateSources(
  liveblocks: Liveblocks,
  roomId: string,
): Promise<Record<string, string>> {
  const ydoc = await fetchDoc(liveblocks, roomId)
  const out: Record<string, string> = {}
  for (const [name, tmap] of ydoc.getMap<Y.Map<any>>('templates').entries()) {
    const source = (tmap.get('source') as Y.Text | undefined)?.toString()
    if (typeof source === 'string') out[name] = source
  }
  return out
}

/** Read a room's deck back as parsed content + filenames. Throws on unparseable pages. */
export async function exportRoom(
  liveblocks: Liveblocks,
  roomId: string,
): Promise<ReadDeckResult> {
  const ydoc = await fetchDoc(liveblocks, roomId)
  return readDeck(ydoc)
}

/**
 * Read a room's raw page sources for file export. Never throws on a page
 * that doesn't parse — sources export verbatim with errors reported.
 */
export async function exportRoomSources(
  liveblocks: Liveblocks,
  roomId: string,
): Promise<ReadDeckSourcesResult> {
  const ydoc = await fetchDoc(liveblocks, roomId)
  return readDeckSources(ydoc)
}
