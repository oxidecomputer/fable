import { transact } from '@tldraw/state'

import { $currentIndex, $deck, $filenames, type Content } from './store'

type Snapshot = {
  deck: Content
  filenames: string[]
  currentIndex: number
}

type Entry = { snapshot: Snapshot; opId: string; ts: number }

const SQUASH_MS = 500
const MAX_HISTORY = 100
const STORAGE_KEY = 'fable:history:v1'

let past: Entry[] = []
let future: Snapshot[] = []
let isApplying = false
let bypassSnapshot: Snapshot | null = null

function take(): Snapshot {
  return {
    deck: $deck.get(),
    filenames: $filenames.get(),
    currentIndex: $currentIndex.get(),
  }
}

function apply(s: Snapshot) {
  isApplying = true
  try {
    transact(() => {
      $deck.set(s.deck)
      $filenames.set(s.filenames)
      $currentIndex.set(s.currentIndex)
    })
  } finally {
    isApplying = false
  }
}

function eq(a: Snapshot, b: Snapshot): boolean {
  return (
    a.deck === b.deck && a.filenames === b.filenames && a.currentIndex === b.currentIndex
  )
}

function push(before: Snapshot, opId: string) {
  past.push({ snapshot: before, opId, ts: Date.now() })
  if (past.length > MAX_HISTORY) past.shift()
  future = []
}

type Persisted = { v: 1; past: Entry[]; future: Snapshot[]; current: Snapshot }

function persist(): void {
  if (typeof localStorage === 'undefined') return
  const write = (entries: Entry[]) => {
    const data: Persisted = { v: 1, past: entries, future, current: take() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
  try {
    write(past)
  } catch {
    // Likely quota exceeded — drop the oldest half and retry; give up cleanly
    // if even that doesn't fit.
    try {
      write(past.slice(Math.floor(past.length / 2)))
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Try to restore history from localStorage. Discards any saved history that
 * doesn't match the live deck — that means the deck was edited from a
 * different session and the saved stack is stale.
 */
export function restoreHistory(): void {
  if (typeof localStorage === 'undefined') return
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return
  }
  if (!raw) return

  const discard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  let data: Persisted
  try {
    data = JSON.parse(raw) as Persisted
  } catch {
    discard()
    return
  }
  if (
    data.v !== 1 ||
    !data.current ||
    !Array.isArray(data.past) ||
    !Array.isArray(data.future)
  ) {
    discard()
    return
  }

  // The saved "current" snapshot must match the live deck. currentIndex is
  // navigation state, not document state, so it's not part of the check.
  if (
    !jsonEq(data.current.deck, $deck.get()) ||
    !jsonEq(data.current.filenames, $filenames.get())
  ) {
    discard()
    return
  }

  past = data.past
  future = data.future
}

/**
 * Run `fn` and record the resulting state change in history.
 *
 * Pass a stable `opId` (e.g. `update-page:0:text`) to squash consecutive
 * commits with the same id within {@link SQUASH_MS}; pass `null` for
 * discrete actions that should never squash. While a bypass is active
 * (see {@link startBypass}), `fn` runs but nothing is recorded.
 */
export function commit(opId: string | null, fn: () => void): void {
  if (isApplying || bypassSnapshot) {
    fn()
    return
  }
  const before = take()
  transact(fn)
  const after = take()
  if (eq(before, after)) return

  const now = Date.now()
  const top = past[past.length - 1]
  if (opId && top && top.opId === opId && now - top.ts < SQUASH_MS) {
    top.ts = now
  } else {
    push(before, opId ?? '__discrete__')
  }
  persist()
}

/**
 * Begin a region during which mutations do not record to history.
 * Used by editors with their own internal undo (e.g. CodeMirror) so
 * their per-keystroke changes don't pollute global history. Pair with
 * {@link endBypass}.
 */
export function startBypass(): void {
  if (bypassSnapshot) return
  bypassSnapshot = take()
}

/**
 * End a bypass region. If the deck changed during the bypass, record a
 * single history entry with the pre-bypass snapshot as `before`.
 */
export function endBypass(opId: string | null): void {
  if (!bypassSnapshot) return
  const before = bypassSnapshot
  bypassSnapshot = null
  const after = take()
  if (eq(before, after)) return
  push(before, opId ?? '__bypass__')
  persist()
}

export function undo(): void {
  if (past.length === 0) return
  const current = take()
  const { snapshot: prev } = past.pop()!
  future.push(current)
  apply(prev)
  persist()
}

export function redo(): void {
  if (future.length === 0) return
  const current = take()
  const next = future.pop()!
  past.push({ snapshot: current, opId: '__redo__', ts: Date.now() })
  if (past.length > MAX_HISTORY) past.shift()
  apply(next)
  persist()
}

export function clearHistory(): void {
  past = []
  future = []
  bypassSnapshot = null
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
