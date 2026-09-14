import { LiveblocksProvider, RoomProvider, useRoom } from '@liveblocks/react'
import { getYjsProviderForRoom } from '@liveblocks/yjs'
import { atom, react } from '@tldraw/state'
import { type ReactNode, useEffect, useState } from 'react'

import type { TemplateExports, TemplateMap } from '../../model'
import { $currentPageId, applyPageFromUrl, noopBackend, setBackend } from '../store'
import { CenteredNotice, Muted } from '../ui'
import { type CollabBridge, connectBridge } from './bridge'

export type CollabConfig = {
  roomId: string
  authEndpoint: string
  /** Bearer token for the hosted server's auth endpoint (v1 shared-token auth). */
  apiToken?: string
}

export type Presence = {
  pageId: string | null
  /** Canvas field this user is editing (`field` or `field:index`), if any. */
  editingField: string | null
}

export const INITIAL_PRESENCE: Presence = { pageId: null, editingField: null }

/** The live bridge, for components that need direct Y.Text/awareness access. */
export const $collabBridge = atom<CollabBridge | null>('collabBridge', null)

export function CollabRoot({
  config,
  baseTemplates,
  templateExports,
  children,
}: {
  config: CollabConfig
  baseTemplates: TemplateMap
  templateExports?: TemplateExports
  children: ReactNode
}) {
  const authEndpoint = async (room?: string) => {
    const res = await fetch(config.authEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiToken ? { authorization: `Bearer ${config.apiToken}` } : {}),
      },
      body: JSON.stringify({ room }),
    })
    if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`)
    return res.json()
  }

  return (
    <LiveblocksProvider
      authEndpoint={authEndpoint}
      resolveUsers={async ({ userIds }) =>
        userIds.map((id) => ({ name: id, color: '#9DAFFA' }))
      }
      resolveMentionSuggestions={async () => []}
    >
      <RoomProvider id={config.roomId} initialPresence={INITIAL_PRESENCE}>
        <CollabConnection baseTemplates={baseTemplates} templateExports={templateExports}>
          {children}
        </CollabConnection>
      </RoomProvider>
    </LiveblocksProvider>
  )
}

function CollabConnection({
  baseTemplates,
  templateExports,
  children,
}: {
  baseTemplates: TemplateMap
  templateExports?: TemplateExports
  children: ReactNode
}) {
  const room = useRoom()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // getYjsProviderForRoom caches per room, so this is StrictMode-safe; the
    // provider is owned by the room and not destroyed on unmount.
    const provider = getYjsProviderForRoom(room)
    let bridge: CollabBridge | null = null
    let disposed = false

    const start = () => {
      if (disposed || bridge) return
      bridge = connectBridge(
        provider.getYDoc(),
        baseTemplates,
        provider.awareness,
        room.id,
        templateExports,
      )
      // y-codemirror renders remote carets from the awareness `user` field.
      const self = room.getSelf()
      ;(provider.awareness as any).setLocalStateField('user', {
        name: self?.info?.name ?? 'Anonymous',
        color: self?.info?.color ?? '#9DAFFA',
        colorLight: `${self?.info?.color ?? '#9DAFFA'}55`,
      })
      setBackend(bridge.backend)
      $collabBridge.set(bridge)
      applyPageFromUrl()
      // The reactor below only fires on changes — publish the initial page.
      room.updatePresence({ pageId: $currentPageId.get() })
      setReady(true)
    }

    if (provider.synced) start()
    else provider.on('synced', start)

    // Publish the current page to presence so others see where we are.
    const stopPresence = react('fable-presence-page', () => {
      const pageId = $currentPageId.get()
      if (bridge) room.updatePresence({ pageId })
    })

    return () => {
      disposed = true
      provider.off('synced', start)
      stopPresence()
      if (bridge) {
        bridge.dispose()
        $collabBridge.set(null)
        setBackend(noopBackend)
      }
    }
  }, [room, baseTemplates, templateExports])

  if (!ready) {
    return (
      <CenteredNotice>
        <Muted>Connecting to room…</Muted>
      </CenteredNotice>
    )
  }
  return <>{children}</>
}
