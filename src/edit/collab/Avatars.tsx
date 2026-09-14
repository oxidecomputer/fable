import { useOthers, useSelf } from '@liveblocks/react'

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
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden border-[1.5px] border-default"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-inverse">{initials(name)}</span>
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
          className="w-2.5 h-2.5 rounded-full border border-tertiary"
          style={{ backgroundColor: o.info?.color ?? '#9DAFFA' }}
        />
      ))}
    </div>
  )
}
