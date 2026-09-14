import { useEffect, useState } from 'react'

/**
 * Sticky footer under the page list showing whether a local MCP server
 * (`fable mcp`, driven by an agent like Claude Code) is running against this
 * deck directory. Ported from mitos's McpIndicator, minus the tab-takeover
 * state — fable's MCP edits the room over Liveblocks, so there's no per-tab
 * connection to move. Dev-only: the dev middleware reports the MCP process's
 * heartbeat at /_fable/mcp; hosted builds render nothing.
 */

const POLL_MS = 5_000

const STATES = {
  active: {
    dot: 'bg-accent-inverse',
    label: 'Connected',
    title: 'An MCP server is running for this deck directory',
  },
  disconnected: {
    dot: 'bg-(--content-quaternary)',
    label: 'No client',
    title: 'No MCP server is running — agents connect via `fable mcp`',
  },
}

export default function McpStatus() {
  const [active, setActive] = useState<boolean | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let disposed = false
    const poll = async () => {
      try {
        const res = await fetch('/_fable/mcp')
        const body = await res.json()
        if (!disposed) setActive(res.ok ? !!body.active : null)
      } catch {
        if (!disposed) setActive(null)
      }
    }
    void poll()
    const timer = window.setInterval(poll, POLL_MS)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  if (active === null) return null

  const state = STATES[active ? 'active' : 'disconnected']

  return (
    <div
      title={state.title}
      className="shrink-0 flex items-center justify-between border-t border-default bg-raise px-3 py-2"
    >
      <span className="text-mono-xs text-quaternary">MCP</span>
      <span className="flex items-center gap-1.5 text-mono-xs text-secondary uppercase">
        <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
        {state.label}
      </span>
    </div>
  )
}
