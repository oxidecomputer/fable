# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Commands

- `npm run dev` (from repo root, or from `dev/`) — runs `fable dev` against the `dev/` deck
  directory (the package consumed via `file:../`, so edits to `src/` hot-reload through it).
  Editing and presenting require a backend: `LIVEBLOCKS_SECRET_KEY` for local dev or
  `VITE_FABLE_API_URL` for a hosted server. Set `FABLE_THEME` there to develop against a
  non-default theme (the default is `oxcon26`, currently the only theme).
- `npm run build` (from repo root, or from `dev/`) — runs `fable build`, output to
  `dev/dist/`.
- `npm run tsc` (root) — type check the package. `cd server && npx tsc` for the server.
- `npm test` — vitest (codec/commands, bridge, template contracts, MCP, Vite loading,
  editor).
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
- **`src/model.ts`** — shared page/deck/template types. Document operations import types
  without loading React or the template compiler.
- **`src/collab/ops.ts`** — shared commands used by the browser bridge and MCP. Page sources
  validate before writes; `patchSlide` merges against current source and rejects an invalid
  draft. Template commands store raw drafts; compilation policy belongs to the caller.
- **`src/edit/collab/bridge.ts`** — wires a Y.Doc to the tldraw atoms. Read path: observers
  reparse only changed page sources (last-good-parse cache; parse failures set `$pageErrors`
  and keep the previous data). Write path: a `Backend` delegates to shared commands and adds
  selection/undo grouping. Structured edits are skipped while source is unparseable; the
  display cache is never written over a draft. Also resolves doc templates into
  `$templates`.
- **`src/edit/collab/room.tsx`** — `CollabRoot` (LiveblocksProvider + RoomProvider + Yjs
  provider via `getYjsProviderForRoom`); gates children until synced, then connects the
  bridge and publishes `$currentPageId` to presence.
- **Undo** — one shared `Y.UndoManager` over `[order, pages, meta, templates]` tracking only
  `LOCAL_ORIGIN`, so undo reverts only local edits. `src/edit/undo.ts` is the facade;
  CodeMirror uses the same manager via `yCollab` + `yUndoManagerKeymap`.
- **Doc-stored templates** — `src/collab/transpile.ts` performs syntax-only TSX → CJS.
  `createTemplateCompiler` in `src/collab/compile.ts` evaluates modules with imports limited
  to `react`, `zod`, and `@oxide/fable` (plus the legacy `./Util` alias). The core API comes
  from `src/template-sdk.ts`; `Theme.templateExports` adds theme primitives. Each compiler
  owns its cache. Evaluation happens in browsers and in Node for MCP validation; rendering
  is separate. Errors surface in the Template tab or `TemplateErrorBoundary`. Sucrase elides
  unused imports.
- **Template contract** — `src/templates/registry.ts` implements document > file > theme
  precedence, including errors for broken overrides. `validation.ts` shares strict root
  validation while preserving schema effects. `src/node/templates.ts` shares file discovery
  and theme selection between the plugin and MCP; MCP evaluates file templates through Vite.
  React and Zod are deduped so contexts and schema constructors match. Contract tests
  validate and render every built-in's canonical example through its forked source.
- **Tailwind for doc templates** — `src/node/doc-template-scan.ts` mirrors doc-template
  sources into `<deck>/.fable/doc-templates/` (gitignored), which the plugin registers as an
  `@source`. Synced by: the bridge (browser PUTs to `/_fable/doc-templates`), the MCP server
  after template ops, dev-server startup, and `buildStart` when a secret is set. Two gotchas
  fixed here: `fablePlugin` must come BEFORE `tailwindcss()` in the plugin array or Tailwind
  consumes the CSS before the appended `@source` lines exist (they pass through verbatim),
  and Tailwind doesn't rescan for NEW files — `reloadPackageCss` / the mcp `reloadCss`
  callback reload the stylesheet module explicitly after a sync.
- **Room-stored files (images)** — assets live in Liveblocks file storage, scoped to the
  room, referenced from page sources as `fable:<fileId>` (still plain strings, so pages
  serialize/parse unchanged). Templates mark fields with `imageField()` /
  `markdownField({ images: true })` from `src/collab/fields.ts` (annotation on the schema
  instance, survives `.optional()`) and resolve values with `useImageSrc` from
  `src/files.tsx`. Refs resolve through backend endpoints because Liveblocks download URLs
  are presigned (~1h): dev `POST/GET /_fable/files/:roomId[/:fileId]` (plugin middleware),
  hosted `/api/files/:roomId[/:fileId]` (token also accepted as a `?token=` query for img
  srcs); GET 302s to the presigned URL (cached server-side in `src/node/collab.ts`). Upload
  paths: drop an image on the edit stage (fills the first empty `imageField`), paste into an
  in-canvas `<Markdown images field=…>` (inserts `![](fable:…)`), or the MCP `upload_file`
  tool. Plain URLs and `public/` paths still work in image fields.
- **Presence** — avatars (`Avatars`, deduped by user id, click = jump to their slide),
  per-page dots, and canvas field selection: while a collaborator edits a field in-canvas,
  presence carries `editingField` (`field` or `field:index`) and other clients outline that
  field in the user's color (`.fable-editable-remote`). Free-floating stage cursors
  (`StageCursors`) were removed — nothing is draggable on the canvas (in git history).
  Liveblocks Comments (a `CommentsPanel` inspector tab with `metadata: { pageId }` threads)
  existed but was removed pending a rethink — it's in git history.
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
  isError result the agent can act on), active document/file/theme fields are validated by
  the shared schema rules, and template source is transpiled and evaluated in Node. Server
  `instructions` document the page-source format, workflow, and the theme's `aiInstructions`
  (`Theme.aiInstructions`, authored per theme). `dev/` ships `.mcp.json` (`npx fable mcp`).
  The earlier Liveblocks AI Copilots tab was removed (in git history) in favor of this; the
  inspector tabs are Source / Template.

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

Returns `[react(), fablePlugin, tailwindcss()]`. The `fablePlugin`:

- Accepts a `userRoot` option (Vite's `root` lives inside the package in CLI mode but the
  deck data lives in the user's cwd).
- Defines `virtual:fable/entry`: imports the selected theme and every
  `templates/*.{jsx,tsx}`, and mounts `<App customTemplates theme collab? />`. The `collab`
  field (`{ authEndpoint, decksEndpoint, filesEndpoint, apiToken? }`) is emitted whenever
  auth is available — `LIVEBLOCKS_SECRET_KEY` (dev → `/_fable/liveblocks-auth`) or
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
present view reading `$deck`. Without it, the app displays a backend configuration notice.
Built-in templates come from the deck directory's theme (a
`Theme = { name, templates, css? }` from `src/theme.ts`; default `src/themes/oxcon26`,
selected with `FABLE_THEME` — the plugin's entry codegen imports only the selected theme and
passes it to `App`, and `fable mcp` honors the same variable), merged with file custom
templates and doc-stored templates (doc > file > theme) into the `TemplateMap` that `Page`
and the editor consume.

`src/themes/oxcon26` is the only theme right now (the stock Oxide theme was removed and will
be re-added later, forked from oxcon26): twelve built-in layouts, plus the OXCON display
language as reusable pieces — the dual grid (`grid.ts`: 12 columns / 3-cell margin / 1-cell
gutters over a 77×22 ASCII cell grid, computed once for the fixed stage), the heatmap shader
background (`ShaderBackground`), and generative PCB-silkscreen micrographics (`Silkscreen`).
Those components plus the grid helpers and capsize re-exports live in
`src/themes/oxcon26/runtime.ts`, re-exported from `@oxide/fable` and supplied through
`Theme.templateExports`, so file and doc-stored templates can use them; the oxcon26
built-ins import from `@oxide/fable` themselves so their source forks into a doc template
unchanged. The grid/capsize entry points only exist in
`@oxide/design-system@6.7.0-canary.8a33f9c` (pinned; same as the oxcon26 site repo).

Per-slide validation: `src/templates/validation.ts` strips routing keys and strict-validates
root fields while preserving effects. The editor displays issues and MCP reports warnings.
`Page.tsx` renders the template through an error boundary that resets when data or template
changes. Stage contexts live in `src/stage.ts` so the template SDK can use them
independently of the application shell.

In-canvas editing: `<Markdown content field="…">` (templates/Util.tsx) renders normally
until clicked on the edit stage, then swaps to a plaintext contentEditable holding the raw
field markdown; blur commits the single field via the backend (synced + undoable), Escape
cancels. String-array items work too: pass `fieldIndex` alongside `field` (see
TitleMultiColumn) — the commit patches just that item within the array. Enabled by
`CanvasEditContext`, provided only by the main-stage `Page` (via `onEditField` from
EditView) — thumbnails/present are untouched. Mousetrap ignores contentEditable, and the
global undo handler skips it so native text undo works while typing.

### Templates

Built-in templates live in `src/themes/oxcon26/templates/*.tsx`; each exports `Schema` (Zod)
and `Template`. To add a built-in, drop a file there and register it in
`src/themes/oxcon26/index.ts` (with a `?raw` source import, a canonical example, and a
one-line description). `src/templates/` holds the shared infrastructure (`Util.tsx`,
`registry.ts`, `validation.ts`). Consumer file templates live in `<consumer>/templates/` and
are compiled into the build; doc-stored templates live in the room and compile at runtime.

### Rendering model

Slides render at a fixed `1920×1080` (16:9) and are scaled with CSS `transform` to fit the
viewport. Size things against the fixed stage — viewport-relative units will not behave as
you expect.

### Styles

Source CSS lives at `styles/src/index.css` (plus `lib/highlight.css` and `lib/pdf.css`).
Fonts (Inter + Inter Display) ship in the package with `@font-face` and CSS variables
(`--fable-font-sans`, `--fable-font-display`) so consumers can swap fonts with a small CSS
override.

### Package exports & bin

- `.` → `./src/index.ts` — browser runtime (`App`, `Markdown`, `FitText`, types)
- `./plugin` → `./src/plugin.ts` — Vite plugin
- `./styles` → `./styles/src/index.css`
- `./collab` → codec + compile; `./node` → Liveblocks node helpers; `./node/deck-files` →
  file IO; `./themes/oxcon26` → the default (and only) theme
- bin: `fable` → `./bin/fable.js`

### Code style

Prettier enforces no semicolons, single quotes, 92-col, trailing commas. Imports are
grouped: `~/…` first, then relative (see `.prettierrc`). ESLint (`.eslintrc`) is TS-only
(`*.js` is ignored) and adds `eqeqeq`, `no-param-reassign`, `no-return-assign`, and
unused-var checking with `_`-prefix ignore.
