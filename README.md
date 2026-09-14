# Fable

> **Warning**: Fable is not much more than an internal experiment in a type of deck
> generator. It won't offer a comprehensive feature set or the robustness of a
> fully-developed library. But it aims to provide a flexible and intuitive tool for
> presentation creation. We greatly appreciate feedback, suggestions, and best of all
> contributions.

Fable is a centrally hosted, collaborative editor where humans and agents author
presentations. React templates provide rich layouts for varied content, with custom layouts
for one-off pages when required. Markdown keeps authoring quick, themes provide a consistent
design language, and [zod](https://zod.dev/) schemas surface content issues in the editor.

![CleanShot 2023-06-19 at 19 07 36](https://github.com/oxidecomputer/fable/assets/4020798/f22a3bc9-9954-4846-849c-daa1878b3278)

## Key Features

- Single-command CLI: `fable dev` / `fable build` — no `vite.config`, no `index.html`, no
  `tailwind.config`
- Schema-validated page templates
- Custom React templates auto-discovered from a `templates/` directory
- Built-in Tailwind CSS support

## How It Works

A page’s source is Markdown with YAML frontmatter that picks a template:

```md
---
template: Basic
title: A Journey Through the Cosmos
---

- In the _vastness of space_, time and distance are but mere illusions
- With societies and cultures _as diverse as the stars_ that light up the skies above
- They are **united** in their quest for knowledge and understanding
```

Pages live in a Liveblocks room. For optional file import/export, `content/deck.yml` lists
their order and names the room:

```yaml
room: my-deck
config:
  page_numbers: true
pages:
  - cover.md
  - cosmos.md
  - thanks.md
```

The `template` key resolves against
[Fable's built-in templates](https://github.com/oxidecomputer/fable/tree/main/src/templates)
or your own custom templates (see below). Any layout you can build with React can be
incorporated into your presentation, so the deck can host things like LaTeX, AsciiMath, or
AsciiDoc by installing a library and rendering it inside a template.

## Getting Started

Fable is centrally hosted — decks live in rooms on the hosted server, so there's nothing to
scaffold or deploy per deck. For local development of the package itself, `npm run dev` from
the repo root runs `fable dev` against the `dev/` deck directory.

A deck directory only needs a `package.json` (and optionally `templates/` and `public/`).
There's no `vite.config`, `index.html`, or `tailwind.config` — the `fable` CLI handles the
build pipeline.

## Navigation

Navigate through slides using the left and right arrow keys. Press `f` to enter fullscreen
mode.

## Custom Templates

Drop a `.jsx` (or `.tsx`) file into your project's `templates/` directory and it will be
auto-discovered. Each template module exports a `Schema` (a `zod` object) and a `Template`
component:

```jsx
import { Markdown } from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({ title: z.string() })

export const Template = ({ data }) => (
  <div className="page-padding flex items-center justify-center">
    <Markdown content={data.title} className="text-[7rem] font-light" />
  </div>
)
```

The editor and MCP use the same active template and validation rules: document templates
override file templates, which override theme templates. Unknown frontmatter keys are
reported alongside other schema issues; refinements and transforms are preserved during
validation.

### Template Utilities

Importable from `@oxide/fable`:

- `Markdown` — parses its `content` prop as Markdown.
- `FitText` — resizes overflowing text to fit its container.

## Styling

Fable supports [Tailwind CSS](https://tailwindcss.com/) v4 out of the box — the CLI's Vite
runtime wires up `@tailwindcss/vite` and scans both the package's built-in templates and
your project's `templates/` directory for utility classes. No `tailwind.config` or
`postcss.config` needed.

### Fonts

Inter and Inter Display ship with the package, so a fresh project renders correctly with no
setup. To swap fonts, drop a CSS file into `public/` (e.g. `public/styles.css`) and override
the CSS variables:

```css
@font-face {
  font-family: 'My Font';
  src: url('/fonts/MyFont.woff2') format('woff2');
}

:root {
  --fable-font-sans: 'My Font', sans-serif;
  --fable-font-display: 'My Font', sans-serif;
}
```

Import it from any custom template (`import '/styles.css'`) and the overrides take effect.

## Multiplayer

The live deck is a [Liveblocks](https://liveblocks.io/) room (a Yjs document); the files in
`content/` are its import/export format. Editing — the sidebar, canvas fields, the raw
source tab, presence, MCP agents — always happens against the room, so any number of
collaborators can edit at once and undo only reverts your own changes.

For local dev, put your secret key in a `.env` file next to `content/` (or export it):

```sh
# .env (gitignored)
LIVEBLOCKS_SECRET_KEY=sk_...   # from liveblocks.io
```

The CLI loads `.env`, `.env.local`, and `.env.[mode]` from the deck directory for every
command — including `fable mcp` (`VITE_FABLE_API_URL` / `VITE_FABLE_API_TOKEN` work there
too); real environment variables take precedence. The server loads its own `./.env` the same
way.

**The directory is the theme, not a deck.** A Fable project holds templates, styles, and
assets; decks live entirely in rooms and are addressed by URL: the bare URL is a **deck
index** (open or create decks), and `/?deck=<room-id>` (or a path like `/my-deck`) opens one
— visiting a new id creates a fresh, empty deck on the spot.

`content/` + `deck.yml` are optional: an import/export format for file-based sync, not app
config. If present, `fable dev` seeds that room on first run, and it's the default deck for
`fable push`/`pull` and the MCP server — whose tools also take a `deck` argument (plus a
`list_decks` tool), so one MCP session can work across every deck in the workspace. Sync
explicitly:

```
fable push [--force]   Seed the room from content/ (refuses to overwrite unless --force)
fable pull             Export the room back into content/ as clean markdown
```

The app requires a backend for editing and presenting. Configure `LIVEBLOCKS_SECRET_KEY` for
the local backend or `VITE_FABLE_API_URL` for a hosted server.

### Doc-stored templates

Besides file-based custom templates (compiled into the build), the editor's **Templates**
tab stores TSX template modules directly in the room. They're compiled in the browser
(sucrase) and update live for everyone — no redeploy. Imports are limited to `react`, `zod`,
and `@oxide/fable`; a broken template shows a compile error without taking down the deck.
Their Tailwind classes work too: sources are mirrored into a gitignored `.fable/` scratch
dir that Tailwind scans, kept in sync by the dev server, the MCP server, and (when
`LIVEBLOCKS_SECRET_KEY` is available) production builds. Note that templates run as code in
every collaborator's browser — only share rooms with people you trust.

The core template API is shared by file imports and document templates. Themes can provide
additional imports through `Theme.templateExports`; OXCON supplies its grid and layout
primitives this way. The compiler keeps its cache scoped to that runtime. A broken document
override reports an error rather than silently falling back to a theme or file layout.

### AI agents (MCP)

`fable mcp` runs an [MCP](https://modelcontextprotocol.io/) server over stdio that exposes
the deck's live room to local agents like Claude Code or Codex. Register it from the deck
directory (`dev/` ships a `.mcp.json` that Claude Code picks up automatically):

```sh
claude mcp add fable -- npx fable mcp
```

If your agent session runs from a different directory (e.g. a monorepo root), point the
server at the deck with `--dir`: `npx fable mcp --dir path/to/deck`.

The agent gets the deck outline (`list_slides` / `read_deck`), slide sources, template
schemas with canonical examples (`list_templates`), and the theme's design vocabulary
(`read_theme` — the full stylesheet plus the theme author's instructions), plus tools to
create/update/move/delete slides, read/create/edit custom doc-stored templates, and drop
static files into `public/` (`add_asset`). Every edit is fetched-mutated-pushed through the
Liveblocks room, so it appears instantly in every open editor. A `screenshot_slide` tool
renders any slide from the live room at 1920×1080 (via a headless system Chrome), so the
agent can verify its edits actually look right instead of assuming success — the result also
reports any elements overflowing the stage, with pixel amounts. By default the MCP process
serves the deck app itself; pass `--render-url <url>` (or set `FABLE_RENDER_URL`) to
screenshot the deployed deck instead — it's connected to the same room and shows exactly
what collaborators see in production (built templates rather than your working tree).
Guardrails keep it idiomatic: slide sources must parse, field values are checked against the
template's zod schema (warnings reported back to the agent), and template source is
transpiled and evaluated in Node before saving to check its imports and exports. Keep
browser APIs inside components or effects; screenshots verify rendering separately in the
browser. The agent is told to prefer existing templates and fork from the closest one when a
new layout is needed.

Theme authors can steer agents via `aiInstructions` on the `Theme` object — it's included in
the MCP server's instructions. The Oxide theme, for example, describes when to reach for
each template and the deck's style idioms.

### Hosted deployment

`server/` contains `@oxide/fable-server`, a small Hono app exposing Liveblocks auth, room
seed/export, and room CRUD. Deploy it anywhere Node runs with `LIVEBLOCKS_SECRET_KEY`,
`FABLE_AUTH_TOKEN`, and (optionally) `PORT` set. Then build the deck against it:

```sh
VITE_FABLE_API_URL=https://fable-api.example.com \
VITE_FABLE_API_TOKEN=<FABLE_AUTH_TOKEN> \
fable build
```

The built static deck connects to the room for live editing and presenting.

## CLI

```
fable dev     Start the dev server in the current directory
fable build   Build a production deck into ./dist
fable push    Seed the deck's room from content/ (--force to overwrite)
fable pull    Export the deck's room back into content/
fable mcp     MCP server (stdio) exposing the room to local agents
```
