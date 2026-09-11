import { useEffect, useState } from 'react'

export type DeckIndexConfig = {
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

/**
 * The landing page: every deck in the workspace (a deck = a Liveblocks
 * room), plus creation. The directory this app was built from is the theme;
 * decks live entirely in rooms, addressed by URL.
 */
export default function DeckIndex({ config }: { config: DeckIndexConfig }) {
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

  const createDeck = () => {
    const id = slugify(name)
    if (!id) return
    // Rooms are created on first auth, so navigating is creating.
    openDeck(id)
  }

  return (
    <div className="fable-editor h-full overflow-y-auto bg-default text-default">
      <div className="max-w-[560px] mx-auto py-16 px-6">
        <h1 className="text-sans-2xl text-raise mb-1">Decks</h1>
        <p className="text-sans-md text-tertiary mb-8">
          Each deck is a live multiplayer room — open one, or create a new one.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createDeck()
          }}
          className="flex gap-2 mb-8"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New deck name"
            className="flex-1 bg-raise border border-default rounded text-sans-md px-3 py-2 text-default placeholder:text-quaternary focus:outline-none focus:border-accent-secondary"
          />
          <button
            type="submit"
            disabled={!slugify(name)}
            className="text-mono-sm text-accent bg-accent-secondary hover:bg-accent-secondary-hover disabled:opacity-50 rounded px-4 py-2"
          >
            Create
          </button>
        </form>

        {error && (
          <div className="text-mono-xs text-destructive mb-4">
            Failed to load decks: {error}
          </div>
        )}
        {!decks && !error && (
          <div className="text-mono-xs text-quaternary">Loading decks…</div>
        )}
        {decks && decks.length === 0 && (
          <div className="text-mono-xs text-quaternary">
            No decks yet — create one above.
          </div>
        )}

        <ul className="list-none p-0 m-0 divide-y divide-[var(--stroke-secondary,#222)] border-y border-default">
          {(decks ?? []).map((deck) => (
            <li key={deck.id}>
              <button
                type="button"
                onClick={() => openDeck(deck.id)}
                className="w-full flex items-baseline justify-between gap-4 py-3 px-1 text-left hover:bg-hover rounded-sm"
              >
                <span className="min-w-0">
                  <span className="block text-sans-lg text-raise truncate">
                    {deck.title ?? deck.id}
                  </span>
                  <span className="block text-mono-xs text-quaternary">{deck.id}</span>
                </span>
                <span className="shrink-0 text-mono-xs text-tertiary">
                  {deck.pageCount} {deck.pageCount === 1 ? 'slide' : 'slides'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
