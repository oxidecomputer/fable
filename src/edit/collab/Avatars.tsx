import { useOthers, useSelf } from '@liveblocks/react'

import { $currentPageId, $pageIds } from '../store'

/** Jump to the slide a collaborator is on (if it still exists). */
function goToPage(pageId: string | null) {
  if (pageId && $pageIds.get().includes(pageId)) $currentPageId.set(pageId)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({
  name,
  color,
  avatar,
  size = 24,
}: {
  name: string
  color: string
  avatar?: string
  size?: number
}) {
  return (
    <div
      title={name}
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-default"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[#080F11] font-semibold">{initials(name)}</span>
      )}
    </div>
  )
}

/** Present-user avatars, overlaid on the stage (top-right). */
export default function Avatars() {
  // One avatar per user: the same person may hold several connections (extra
  // tabs); keep the most recently updated one that has a position.
  const users = useOthers((others) => {
    const byId = new Map<string, (typeof others)[number]>()
    for (const other of others) {
      const key = other.id ?? String(other.connectionId)
      const existing = byId.get(key)
      if (!existing || other.presence.pageId !== null) byId.set(key, other)
    }
    return [...byId.values()]
  })
  const self = useSelf()

  return (
    <div className="flex items-center -space-x-2">
      {users.slice(0, 5).map((other) => {
        const name = other.info?.name ?? 'Anonymous'
        const pageId = other.presence.pageId
        return (
          <button
            key={other.id ?? other.connectionId}
            type="button"
            onClick={() => goToPage(pageId)}
            disabled={!pageId}
            title={pageId ? `${name} — jump to their slide` : name}
            className="rounded-full enabled:cursor-pointer"
          >
            <Avatar
              size={28}
              name={name}
              color={other.info?.color ?? '#9DAFFA'}
              avatar={other.info?.avatar}
            />
          </button>
        )
      })}
      {users.length > 5 && (
        <div className="rounded-full w-7 h-7 flex items-center justify-center bg-default border border-default text-mono-xs text-quaternary">
          +{users.length - 5}
        </div>
      )}
      {self && (
        <Avatar
          size={28}
          name={self.info?.name ?? 'You'}
          color={self.info?.color ?? '#88DCB7'}
          avatar={self.info?.avatar}
        />
      )}
    </div>
  )
}

/** Small presence dots for a page row in the sidebar. */
export function PagePresenceDots({ pageId }: { pageId: string }) {
  const users = useOthers((others) => others.filter((o) => o.presence.pageId === pageId))
  if (users.length === 0) return null
  return (
    <div className="absolute top-1 right-1 flex -space-x-1">
      {users.slice(0, 3).map((o) => (
        <div
          key={o.connectionId}
          title={o.info?.name ?? 'Anonymous'}
          className="w-2.5 h-2.5 rounded-full border border-[#080F11]"
          style={{ backgroundColor: o.info?.color ?? '#9DAFFA' }}
        />
      ))}
    </div>
  )
}
