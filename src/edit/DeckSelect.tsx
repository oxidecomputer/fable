import { atom } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import { useEffect, useState } from 'react'

import { Button, ErrorText, Input, Muted } from './ui'

export type DeckSelectConfig = {
  decksEndpoint: string
  apiToken?: string
}

type DeckSummary = {
  id: string
  title: string | null
  pageCount: number
  lastConnectionAt: string | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function openDeck(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('deck', id)
  url.searchParams.delete('page')
  window.location.href = url.toString()
}

/** Whether the dismissible deck-select modal is open (see openDeckSelect). */
export const $deckSelectOpen = atom('deckSelectOpen', false)

export function openDeckSelect() {
  $deckSelectOpen.set(true)
}

/** Mounts the dismissible modal when opened from the editor chrome. */
export function DeckSelectHost({
  config,
  currentDeckId,
}: {
  config: DeckSelectConfig
  currentDeckId?: string
}) {
  const open = useValue($deckSelectOpen)
  if (!open) return null
  return (
    <DeckSelectModal
      config={config}
      currentDeckId={currentDeckId}
      onClose={() => $deckSelectOpen.set(false)}
    />
  )
}

/**
 * Deck selection as a modal: every deck in the workspace (a deck = a
 * Liveblocks room), plus creation. The directory this app was built from is
 * the theme; decks live entirely in rooms, addressed by URL. Without
 * `onClose` the modal is forced (no deck selected) and can't be dismissed.
 */
export function DeckSelectModal({
  config,
  currentDeckId,
  onClose,
}: {
  config: DeckSelectConfig
  currentDeckId?: string
  onClose?: () => void
}) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(config.decksEndpoint, {
      headers: config.apiToken ? { authorization: `Bearer ${config.apiToken}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const sorted = [...(data.decks ?? [])].sort((a: DeckSummary, b: DeckSummary) =>
          (b.lastConnectionAt ?? '').localeCompare(a.lastConnectionAt ?? ''),
        )
        setDecks(sorted)
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [config.decksEndpoint, config.apiToken])

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const createDeck = () => {
    const id = slugify(name)
    if (!id) return
    // Rooms are created on first auth, so navigating is creating.
    openDeck(id)
  }

  return (
    <div
      className="fable-editor fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[480px] max-h-[80vh] flex flex-col rounded-lg border border-default bg-raise text-default shadow-lg">
        <div className="shrink-0 flex items-start justify-between px-5 pt-5 pb-0">
          <div>
            <h1 className="text-sans-lg text-raise mb-0.5">Decks</h1>
            <p className="text-sans-sm text-tertiary">
              Each deck is a live multiplayer room — open one, or create a new one.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mt-1 -mr-1 p-1 rounded text-quaternary hover:text-default hover:bg-hover"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createDeck()
          }}
          className="shrink-0 flex gap-2 px-5 pt-4 pb-4 border-b border-default"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New deck name"
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={!slugify(name)}>
            Create
          </Button>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {error && (
            <ErrorText className="px-3 py-2">Failed to load decks: {error}</ErrorText>
          )}
          {!decks && !error && <Muted className="px-3 py-2">Loading decks…</Muted>}
          {decks && decks.length === 0 && (
            <Muted className="px-3 py-2">No decks yet — create one above.</Muted>
          )}

          <ul className="list-none p-0 m-0">
            {(decks ?? []).map((deck) => {
              const isCurrent = deck.id === currentDeckId
              return (
                <li key={deck.id}>
                  <button
                    type="button"
                    onClick={() => (isCurrent ? onClose?.() : openDeck(deck.id))}
                    className={`w-full flex items-baseline justify-between gap-4 py-2.5 px-3 text-left rounded hover:bg-hover ${
                      isCurrent ? 'bg-accent-secondary' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sans-md text-raise truncate">
                        {deck.title ?? deck.id}
                      </span>
                      <span className="block text-mono-xs text-quaternary">{deck.id}</span>
                    </span>
                    <span className="shrink-0 text-mono-xs text-tertiary">
                      {deck.pageCount} {deck.pageCount === 1 ? 'slide' : 'slides'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
