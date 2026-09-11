import type { Liveblocks } from '@liveblocks/node'
import {
  type CollabUser,
  RoomNotEmptyError,
  authorizeUser,
  createLiveblocks,
  ensureRoom,
  exportRoomSources,
  listDecks,
  seedRoom,
} from '@oxide/fable/node'
import { Hono } from 'hono'

export type FableServerOptions = {
  liveblocksSecretKey: string
  /**
   * Shared bearer token protecting every endpoint. v1 auth — real identity
   * is a pre-Phase-B decision; swap in a `resolveUser` for anything better.
   */
  authToken: string
  /**
   * Maps an authenticated request to a collaborator identity. Default: the
   * `userId` field of the auth request body, else "anonymous".
   */
  resolveUser?: (c: { body: any; headers: Headers }) => CollabUser | Promise<CollabUser>
}

export function createFableServer(options: FableServerOptions): Hono {
  const liveblocks: Liveblocks = createLiveblocks(options.liveblocksSecretKey)
  const app = new Hono()

  app.use('*', async (c, next) => {
    const header = c.req.header('authorization') ?? ''
    const token = header.replace(/^Bearer\s+/i, '')
    if (!options.authToken || token !== options.authToken) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  })

  app.post('/api/liveblocks-auth', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const roomId = body.room
    if (typeof roomId !== 'string' || !roomId) {
      return c.json({ error: 'Expected { room }' }, 400)
    }
    const user: CollabUser = options.resolveUser
      ? await options.resolveUser({ body, headers: c.req.raw.headers })
      : { id: typeof body.userId === 'string' ? body.userId : 'anonymous' }

    await ensureRoom(liveblocks, roomId)
    const { status, body: authBody } = await authorizeUser(liveblocks, roomId, user)
    return c.newResponse(authBody, status as any, {
      'content-type': 'application/json',
    })
  })

  app.get('/api/decks', async (c) => {
    return c.json({ decks: await listDecks(liveblocks) })
  })

  app.get('/api/rooms', async (c) => {
    const { data } = await liveblocks.getRooms()
    return c.json({
      rooms: data.map((room) => ({ id: room.id, createdAt: room.createdAt })),
    })
  })

  app.post('/api/rooms/:id', async (c) => {
    await ensureRoom(liveblocks, c.req.param('id'))
    return c.json({ ok: true })
  })

  app.delete('/api/rooms/:id', async (c) => {
    await liveblocks.deleteRoom(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.post('/api/rooms/:id/seed', async (c) => {
    const roomId = c.req.param('id')
    const body = await c.req.json().catch(() => null)
    if (!body?.content || !Array.isArray(body?.filenames)) {
      return c.json({ error: 'Expected { content, filenames, force? }' }, 400)
    }
    try {
      await seedRoom(liveblocks, roomId, body.content, body.filenames, {
        force: !!body.force,
      })
    } catch (err) {
      if (err instanceof RoomNotEmptyError) return c.json({ error: err.message }, 409)
      throw err
    }
    return c.json({ ok: true })
  })

  app.get('/api/rooms/:id/export', async (c) => {
    const { meta, filenames, sources, parseErrors } = await exportRoomSources(
      liveblocks,
      c.req.param('id'),
    )
    return c.json({ meta, filenames, sources, parseErrors })
  })

  return app
}
