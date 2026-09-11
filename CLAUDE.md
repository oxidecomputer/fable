# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Commands

- `npm run dev` (from repo root, or from `starter/main/`) — runs `fable dev` against the
  starter. The starter consumes the package via `file:../../`, so edits to `src/` hot-reload
  through it. Editing requires `LIVEBLOCKS_SECRET_KEY` (env var or a `.env` file in the deck
  directory); without it the dev server serves present mode only.
- `npm run build` (from `starter/main/`) — runs `fable build`, output to
  `starter/main/dist/`.
- `npm run tsc` (root) — type check the package. `cd server && npx tsc` for the server.
- `npm test` — vitest (codec round-trips, bridge, template compile, EditShell).
- `npm run fmt` / `npm run fmt:check` — Prettier.

PDF export was removed pending a cleaner re-implementation.

## Architecture

Fable is published as `@oxide/fable` and consumed as **a CLI** (`fable dev`, `fable build`,
`fable push`, `fable pull`). The package ships TypeScript source (`src/`, `styles/src/`)
plus a Node CLI (`bin/fable.js`) and a Vite runtime shell (`runtime/`). There's no separate
build step for the package itself. `server/` is a workspace package (`@oxide/fable-server`)
hosting the deployable API.

### Collaboration model (Liveblocks is the source of truth)

**The directory is the theme; decks are rooms.** Every deck is a Liveblocks room holding one
Yjs doc, addressed by URL (bare URL = deck index in `src/edit/DeckIndex.tsx`, backed by
`GET /_fable/decks` in dev / `GET /api/decks` hosted, via `listDecks`). `content/` +
`deck.yml` are an optional import/export format (push/pull, first-run seed, MCP default
room) — the app itself never reads them. The doc layout (see `src/collab/doc.ts`):

```
meta:      Y.Map                  { title?, config?, v: 1 }
order:     Y.Array<string>        page ids (nanoid)
pages:     Y.Map<pageId, Y.Map>   { source: Y.Text, filename: string }
templates: Y.Map<name, Y.Map>     { source: Y.Text }  — doc-stored TSX templates
```

Each page's `source` Y.Text holds exactly `serializePage()` output (frontmatter + body),
parsed with `parsePage()` on read. `applyTextDiff` (fast-diff) writes minimal splices so
concurrent edits merge cleanly.

- **`src/collab/doc.ts`** — isomorphic codec: `seedDoc`, `readDeck`, `deckToYUpdate`,
  `applyTextDiff`. Shared by browser, plugin, CLI, and server.
- **`src/edit/collab/bridge.ts`** — wires a Y.Doc to the tldraw atoms. Read path: observers
  reparse only changed page sources (last-good-parse cache; parse failures set `$pageErrors`
  and keep the previous data). Write path: a `Backend` that parses current source, merges
  the patch (`''` deletes a key), serializes, and applies a text diff inside
  `ydoc.transact(fn, LOCAL_ORIGIN)`. Also compiles doc-stored templates into `$templates`.
- **`src/edit/collab/room.tsx`** — `CollabRoot` (LiveblocksProvider + RoomProvider + Yjs
  provider via `getYjsProviderForRoom`); gates children until synced, then connects the
  bridge and publishes `$currentPageId` to presence.
- **Undo** — one shared `Y.UndoManager` over `[order, pages, meta, templates]` tracking only
  `LOCAL_ORIGIN`, so undo reverts only local edits. `src/edit/undo.ts` is the facade;
  CodeMirror uses the same manager via `yCollab` + `yUndoManagerKeymap`.
- **Doc-stored templates** — `src/collab/compile.ts` compiles TSX with sucrase
  (typescript+jsx+imports → CJS) and evaluates with a require shim limited to `react`,
  `zod`, `@oxide/fable`. Compile errors surface in the Templates tab; render errors hit
  `TemplateErrorBoundary`. This is trusted-collaborator code execution — room-scoped, never
  server-side. Note: sucrase elides unused imports.
- **Tailwind for doc templates** — `src/node/doc-template-scan.ts` mirrors doc-template
  sources into `<deck>/.fable/doc-templates/` (gitignored), which the plugin registers as an
  `@source`. Synced by: the bridge (browser PUTs to `/_fable/doc-templates`), the MCP server
  after template ops, dev-server startup, and `buildStart` when a secret is set. Two gotchas
  fixed here: `fablePlugin` must come BEFORE `tailwindcss()` in the plugin array or Tailwind
  consumes the CSS before the appended `@source` lines exist (they pass through verbatim),
  and Tailwind doesn't rescan for NEW files — `reloadPackageCss` / the mcp `reloadCss`
  callback reload the stylesheet module explicitly after a sync.
- **Comments/presence** — Liveblocks Comments with `metadata: { pageId }` filtering
  (`CommentsPanel`), avatars (`Avatars`, deduped by user id, click = jump to their slide),
  per-page dots, and stage cursors in 1920×1080 stage coordinates (`StageCursors`).
- **AI = local agents over MCP** — `fable mcp` (bin command) starts a stdio MCP server
  (`src/node/mcp.ts`, loaded via ssrLoadModule with a silent Vite server that stays alive;
  stdout carries the protocol, logs go to stderr). Tools: list/read/update/create/delete/
  move_slide, set_deck_title, list/read/create/update/delete_template. Each call fetches the
  room doc via `@liveblocks/node`, applies a pure op from `src/collab/ops.ts`, and sends the
  diff update — edits appear live in open editors. `screenshot_slide` renders a slide at
  1920×1080: the mcp command runs a full silent fable dev server (also the TS module
  runner), and a headless system Chrome (playwright-core, `channel: 'chrome'`, override with
  `FABLE_CHROME`) holds the deck open in `?pdf` mode — every slide at exact viewport size,
  live-connected to the room — and element-screenshots the nth `main`. `?present` / `?pdf`
  URL params force present mode in collab. Guardrails: slide sources must parse (`OpError` →
  isError result the agent can act on), theme-template fields are strict-parsed for schema
  warnings, template source is sucrase compile-validated. Server `instructions` document the
  page-source format, workflow, and the theme's `aiInstructions` (`Theme.aiInstructions`,
  authored per theme). The starter ships `.mcp.json` (`npx fable mcp`). The earlier
  Liveblocks AI Copilots tab was removed (in git history) in favor of this; the inspector
  tabs are Content / Source / Comments / Templates.

### Store (`src/edit/store.ts`)

State is keyed by stable page ids: `$pageIds`, `$pagesById`, `$filenamesById`,
`$currentPageId`, with `$deck`/`$filenames`/`$currentIndex`/`$currentPage` as computeds so
consumers stay index-friendly. Mutators (`updatePage`, `addPage`, …) take indices, resolve
ids, and dispatch to the bridge's `Backend` (a `noopBackend` before connection). Components
never mutate the atoms directly — the bridge round-trips every change through the doc.

### Consumer setup

A consumer's directory only needs:

```
my-deck/
  templates/         # optional: theme-extension .jsx/.tsx templates (build-time)
  public/            # optional: static assets
  content/           # optional: deck.yml + .md pages (import/export only)
  package.json       # depends on @oxide/fable; scripts: fable dev / fable build
```

No `vite.config`, no `index.html`, no `tailwind.config`. The CLI spawns Vite with
`runtime/index.html` + `runtime/main.ts` as the entry, and the Fable plugin handles
content/template discovery from the user's cwd.

### CLI (`bin/fable.js`)

`fable dev` / `fable build` programmatically invoke Vite with `configFile` pointing at
`runtime/vite.config.ts`, setting `FABLE_USER_ROOT=process.cwd()`. Every command first loads
`.env` / `.env.local` / `.env.[mode]` from the deck directory into `process.env` (via Vite's
`loadEnv`; real env vars win). `fable push` / `fable pull` sync `content/` with the room
(they load the package's TS via a throwaway Vite server in middleware mode and
`ssrLoadModule`); push refuses to overwrite a non-empty room without `--force`.

### What the plugin does (`src/plugin.ts`)

Returns `[react(), tailwindcss(), fablePlugin]`. The `fablePlugin`:

- Accepts a `userRoot` option (Vite's `root` lives inside the package in CLI mode but the
  deck data lives in the user's cwd).
- Defines `virtual:fable/entry`: statically imports the deck files (static present fallback)
  and every `templates/*.{jsx,tsx}`, and mounts `<App content collab? />`. The `collab`
  field (`{ roomId: string | null, authEndpoint, apiToken? }`) is emitted whenever auth is
  available — `LIVEBLOCKS_SECRET_KEY` (dev → `/_fable/liveblocks-auth`) or
  `VITE_FABLE_API_URL` (+ optional `VITE_FABLE_API_TOKEN`). The URL picks the deck
  (`?deck=<id>` or first path segment, see `deckIdFromUrl` in App.tsx); the bare URL is the
  deck index. New room ids are auto-created on first auth. The entry embeds no deck content
  — the app is a pure room client.
- Dev middleware: `POST /_fable/liveblocks-auth` (access-token auth via
  `src/node/collab.ts`; identity = OS username, override with `FABLE_USER`). On dev start it
  auto-seeds an empty room from `content/`.
- `transform()`s the package CSS to append a Tailwind `@source` for the user's templates;
  resolves `@oxide/fable` bare specifiers to package source; adds `userRoot` to
  `server.fs.allow`; watches `content/` + `templates/` and full-reloads on change.

### Node/server side

- `src/node/deck-files.ts` — `loadDeck`/`serializeDeck` (files ⇄ plain content; preserves
  `room:` in deck.yml).
- `src/node/collab.ts` — `@liveblocks/node` helpers: `authorizeUser`, `seedRoom` (diff
  update against current doc state), `exportRoom`, `RoomNotEmptyError`.
- `server/src/app.ts` — Hono app: `POST /api/liveblocks-auth`, room CRUD,
  `POST /api/rooms/:id/seed`, `GET /api/rooms/:id/export`, all behind a shared
  `FABLE_AUTH_TOKEN` bearer (v1 auth; real identity is a later decision).
  `server/src/main.ts` is the Node entry (`tsx`), env: `LIVEBLOCKS_SECRET_KEY`,
  `FABLE_AUTH_TOKEN`, `PORT`.

### Runtime (`src/App.tsx`, `src/Page.tsx`)

With `collab` set, `App` renders `CollabRoot` around the editor (edit mode) or a live
present view reading `$deck`. Without it, the static build-time content renders in present
mode only. Built-in templates come from the default theme (`src/themes/oxide`, a
`Theme = { name, templates, css? }` from `src/theme.ts`), merged with file custom templates
and doc-stored templates (doc > file > theme) into the `TemplateMap` that `Page` and
`SchemaForm` consume.

Per-slide validation: `Page.tsx` strips routing keys and `.strict()`s the template's Zod
schema; errors render as an in-page table instead of throwing.

In-canvas editing: `<Markdown content field="…">` (templates/Util.tsx) renders normally
until clicked on the edit stage, then swaps to a plaintext contentEditable holding the raw
field markdown; blur commits the single field via the backend (synced + undoable), Escape
cancels. String-array items work too: pass `fieldIndex` alongside `field` (see
TitleMultiColumn) — the commit patches just that item within the array. Enabled by
`CanvasEditContext`, provided only by the main-stage `Page` (via `onEditField` from
EditView) — thumbnails/present are untouched. Mousetrap ignores contentEditable, and the
global undo handler skips it so native text undo works while typing.

### Templates

Built-in templates live in `src/templates/*.tsx`; each exports `Schema` (Zod) and
`Template`. To add a built-in, drop a file there and register it in
`src/themes/oxide/index.ts`. Consumer file templates live in `<consumer>/templates/` and are
compiled into the build; doc-stored templates live in the room and compile at runtime.

### Rendering model

Slides render at a fixed `1920×1080` (16:9) and are scaled with CSS `transform` to fit the
viewport. Size things against the fixed stage — viewport-relative units will not behave as
you expect. Presence cursors are stored in stage coordinates for the same reason.

### Styles

Source CSS lives at `styles/src/index.css` (plus `lib/highlight.css` and `lib/pdf.css`).
Fonts (Inter + Inter Display) ship in the package with `@font-face` and CSS variables
(`--fable-font-sans`, `--fable-font-display`) so consumers can swap fonts with a small CSS
override. `@liveblocks/react-ui` styles are imported by `CommentsPanel`.

### `@oxide/create-fable`

`starter/index.js` scaffolds a new project from `starter/main/`, rewriting the
`@oxide/fable` dependency to the published version and `deck.yml`'s `room:` to the project
name (each new project gets its own room).

### Package exports & bin

- `.` → `./src/index.ts` — browser runtime (`App`, `Markdown`, `FitText`, types)
- `./plugin` → `./src/plugin.ts` — Vite plugin
- `./styles` → `./styles/src/index.css`
- `./collab` → codec + compile; `./node` → Liveblocks node helpers; `./node/deck-files` →
  file IO; `./themes/oxide` → default theme
- bin: `fable` → `./bin/fable.js`

### Code style

Prettier enforces no semicolons, single quotes, 92-col, trailing commas. Imports are
grouped: `~/…` first, then relative (see `.prettierrc`). ESLint (`.eslintrc`) is TS-only
(`*.js` is ignored) and adds `eqeqeq`, `no-param-reassign`, `no-return-assign`, and
unused-var checking with `_`-prefix ignore.
