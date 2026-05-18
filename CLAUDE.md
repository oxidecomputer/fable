# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Commands

- `npm run dev` (from repo root, or from `starter/main/`) — runs `fable dev` against the
  starter. The starter consumes the package via `file:../../`, so edits to `src/` hot-reload
  through it.
- `npm run build` (from `starter/main/`) — runs `fable build`, output to
  `starter/main/dist/`.
- `npm run tsc` (root) — type check the package.
- `npm run fmt` / `npm run fmt:check` — Prettier.

There is no test runner. PDF export was removed pending a cleaner re-implementation.

## Architecture

Fable is published as `@oxide/fable` and consumed as **a CLI** (`fable dev`, `fable build`).
The package ships TypeScript source (`src/`, `styles/src/`) plus a Node CLI (`bin/fable.js`)
and a Vite runtime shell (`runtime/`). There's no separate build step for the package
itself.

### Consumer setup

A consumer's directory only needs:

```
my-deck/
  content/           # required: deck.yml + .md pages
  templates/         # optional: custom .jsx/.tsx templates
  public/            # optional: static assets
  package.json       # depends on @oxide/fable; scripts: fable dev / fable build
```

No `vite.config`, no `index.html`, no `tailwind.config`. The CLI spawns Vite with
`runtime/index.html` + `runtime/main.ts` as the entry, and the Fable plugin handles
content/template discovery from the user's cwd.

### CLI (`bin/fable.js`)

`fable dev` / `fable build` programmatically invoke Vite with `configFile` pointing at
`runtime/vite.config.ts`. The CLI sets `FABLE_USER_ROOT=process.cwd()` so the plugin knows
where the consumer's `content/` and `templates/` live, and overrides `publicDir` and
`build.outDir` to land inside the user's cwd.

### What the plugin does (`src/plugin.ts`)

Returns `[react(), tailwindcss(), fablePlugin]`. The `fablePlugin`:

- Accepts a `userRoot` option (Vite's `root` lives inside the package in CLI mode but the
  deck data lives in the user's cwd). Falls back to Vite's `root` for the legacy mode.
- Defines a virtual module `virtual:fable/entry` whose generated source statically imports
  the consumer's `content/` via `loadDeck`, statically imports every `*.{jsx,tsx}` it finds
  under `<userRoot>/templates/`, and mounts `<App content={...} customTemplates={...} />`
  into `#root`. `runtime/main.ts` is the actual Vite entry and just does
  `import 'virtual:fable/entry'` — that's what makes the build pick it up.
- `transform()`s `styles/src/index.css` to append a Tailwind v4 `@source` directive pointing
  at the user's templates dir, so utility classes used in custom templates make it into the
  emitted CSS (Tailwind's auto source detection doesn't follow files outside Vite's root).
- Resolves bare specifiers from user templates: `@oxide/fable`, `@oxide/fable/styles`, and
  `@oxide/fable/plugin` map to absolute paths inside the package; other bare specifiers
  (e.g. `zod`) fall back to `createRequire(packageRoot).resolve(id)` so user templates can
  reuse the package's own `node_modules`.
- Adds `userRoot` to `server.fs.allow` and registers `content/` + `templates/` with
  `server.watcher`, so files outside Vite's root get served and watched.
- Exposes `/_fable/content` dev middleware (GET/PUT) for the in-page editor to read and
  persist deck state.
- Options: `{ contentDir?: string, templatesDir?: string, userRoot?: string }` (defaults
  `'content'`, `'templates'`, Vite's `root`).

### Runtime (`src/App.tsx`, `src/Page.tsx`)

`App` receives `content` and `customTemplates` as props. Built-in templates are statically
imported in `App.tsx` and merged with custom ones into a single `TemplateMap`
(`{ [name]: { Template, Schema? } }`) passed to `Page`. `Page` looks up the template
synchronously by `data.template` — no dynamic `import()`, no `window.ENV`, no async state.

Per-slide validation: `Page.tsx` strips the routing keys (`template`, `custom_template`)
from the data, then calls `.strict()` on the template's Zod schema before parsing. This
catches typo'd keys (e.g. `text_typo` instead of `text`) without each template author having
to remember `.strict()`. Validation errors render as an in-page table instead of throwing.

### Templates

Built-in templates live in `src/templates/*.tsx`. Each module exports `Schema` (Zod) and
`Template` (`({ data }) => JSX`). To add a new built-in, drop a file there and add it to the
`builtInTemplates` map in `src/App.tsx`.

Consumer custom templates live in `<consumer>/templates/*.{jsx,tsx}` and are auto-discovered
by the plugin via `fs.readdir`. Custom templates can import shared utilities from the public
package surface: `import { Markdown, FitText } from '@oxide/fable'`.

### Rendering model

Slides render at a fixed `1920×1080` (16:9) and are scaled with CSS `transform` to fit the
viewport. PDF mode (`?pdf=true`) stacks every page at `scale=1` and adds the `--pdf` class
to `body`. (The PDF export script was removed and will be re-added.) Size things against the
fixed 1920×1080 stage — viewport-relative units will not behave as you expect.

### Styles

Source CSS lives at `styles/src/index.css` (plus `lib/highlight.css` and `lib/pdf.css`). The
virtual entry imports it via an absolute path so it works whether Vite's root is the
consumer dir (legacy) or `runtime/` (CLI).

Fonts (Inter + Inter Display) ship inside the package at `styles/src/fonts/`, declared via
`@font-face` in the package CSS with relative `url('./fonts/...')` paths that Vite rewrites
and asset-hashes during the consumer's build. The font-family is wired through CSS variables
(`--fable-font-sans`, `--fable-font-display`) so consumers can swap fonts with a tiny CSS
override (declare their own `@font-face` + reassign the variables). Plugin sets
`server.fs.allow` to include the package root so the woff2 assets resolve via Vite's `/@fs/`
route in dev.

### `@oxide/create-fable`

`starter/index.js` is the scaffolder (`npx @oxide/create-fable`). It does a recursive copy
of `starter/main/` into the new project directory, with one file-specific transform:
rewriting `package.json`'s `"@oxide/fable": "file:../../"` to the published version.

### Package exports & bin

- `.` → `./src/index.ts` — browser runtime (`App`, `Markdown`, `FitText`, types)
- `./plugin` → `./src/plugin.ts` — Vite plugin
- `./styles` → `./styles/src/index.css` — source CSS, processed by consumer Vite
- bin: `fable` → `./bin/fable.js`

### Code style

Prettier enforces no semicolons, single quotes, 92-col, trailing commas. Imports are
grouped: `~/…` first, then relative (see `.prettierrc`). ESLint (`.eslintrc`) is TS-only
(`*.js` is ignored) and adds `eqeqeq`, `no-param-reassign`, `no-return-assign`, and
unused-var checking with `_`-prefix ignore.
