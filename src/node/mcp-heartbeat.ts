import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * The MCP server is a separate process from the dev server (an agent like
 * Claude Code spawns `fable mcp` over stdio), so the editor can't observe it
 * directly. Both processes run from the same deck directory: the MCP process
 * touches a heartbeat file under `.fable/` (gitignored, like the doc-template
 * scratch dir) and the dev middleware reports its freshness to the editor's
 * MCP indicator.
 */

const INTERVAL_MS = 5_000
// Generous multiple of the interval so a busy event loop doesn't flicker the
// indicator, while a killed process still reads as gone quickly.
const STALE_MS = 15_000

function heartbeatFile(userRoot: string): string {
  return path.join(userRoot, '.fable', 'mcp-heartbeat')
}

/** Start touching the heartbeat file. Returns a stop function (unlinks it). */
export function startMcpHeartbeat(userRoot: string): () => Promise<void> {
  const file = heartbeatFile(userRoot)
  const beat = async () => {
    await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {})
    await fs.writeFile(file, `${process.pid}\n`).catch(() => {})
  }
  void beat()
  const timer = setInterval(beat, INTERVAL_MS)
  timer.unref?.()
  return async () => {
    clearInterval(timer)
    await fs.unlink(file).catch(() => {})
  }
}

/** Whether an MCP process has touched the heartbeat recently. */
export async function mcpHeartbeatFresh(userRoot: string): Promise<boolean> {
  try {
    const stat = await fs.stat(heartbeatFile(userRoot))
    return Date.now() - stat.mtimeMs < STALE_MS
  } catch {
    return false
  }
}
