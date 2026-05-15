# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Commands

- `npm run dev` (from repo root, or `npm run dev` from `starter/main/`) — runs the starter
  via Vite on the default port. The starter consumes the package via `file:../../`, so edits
  to `src/` hot-reload through it.
- `npm run build` — `vite build` against the starter (used for verifying the deck compiles
  cleanly and for `export-pdf`).
- `npm run preview` — serves the built starter.
- `npm run tsc` (root) — type check the package.
- `npm run export-pdf` (from `starter/main/`) — builds the starter, then spawns
  `vite preview` internally and Puppeteer captures all slides into `export.pdf`. No
  long-running dev server required.
- `npm run fmt` / `npm run fmt:check` — Prettier.

There is no test runner.

## Architecture

Fable is published as `@oxide/fable` and consumed as **a Vite plugin**. The package ships
TypeScript source (`src/`, `styles/src/`, `scripts/`) — there is no separate build step; the
consumer's Vite resolves directly into the package.

### Consumer setup

```ts
// vite.config.ts
import fable from '@oxide/fable/plugin'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [fable()] })
```

That's the entire build config. The consumer also has a `content.toml`, an `index.html` with
a `#root` div, and (optionally) a `templates/` directory of custom `.jsx` templates. No
`tailwind.config`, no `postcss.config`, no separate CSS step.

### What the plugin does (`src/plugin.ts`)

Returns `[react(), ViteToml(), fablePlugin]`. The `fablePlugin`:

- Configures `css.postcss` with Tailwind + autoprefixer, scanning both the package's own
  `src/**/*.{ts,tsx}` and the consumer's `templates/**/*.{jsx,tsx}` for utility classes.
- Defines a virtual entry module `virtual:fable/entry` whose generated source statically
  imports the consumer's TOML, uses
  `import.meta.glob('/templates/*.{jsx,tsx}', { eager: true })` to gather custom templates,
  and mounts `<App content={...} customTemplates={...} />` into `#root`. The virtual is
  plain JS (no JSX) and uses `React.createElement` so it doesn't need a `.tsx`-suffixed
  virtual id.
- Injects `<script type="module" src="/@id/virtual:fable/entry">` into `index.html` via
  `transformIndexHtml`.
- Options: `{ content?: string, templatesDir?: string }` (defaults `'content.toml'`,
  `'templates'`).

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
by the plugin's `import.meta.glob`. Custom templates can import shared utilities from the
public package surface: `import { Markdown, FitText } from '@oxide/fable'`. The old `~/Util`
alias is gone.

### Rendering model

Slides render at a fixed `1920×1080` (16:9) and are scaled with CSS `transform` to fit the
viewport. PDF mode (`?pdf=true`) stacks every page at `scale=1` and adds the `--pdf` class
to `body`; Puppeteer captures the result at 1920×1080 per page in `scripts/exportPdf.js`.
Size things against the fixed 1920×1080 stage — viewport-relative units will not behave as
you expect.

### Styles

Source CSS lives at `styles/src/index.css` (plus `lib/highlight.css` and `lib/pdf.css`). The
plugin's virtual entry imports it via `import '@oxide/fable/styles'`, so Vite's PostCSS
pipeline (configured by the plugin) processes it through Tailwind. Design-system classes
(`page-padding`, `large-title`, `markdown`, `error-table`, etc.) live in the package — they
belong with the built-in templates that use them.

Fonts (Inter + Inter Display) ship inside the package at `styles/src/fonts/`, declared via
`@font-face` in the package CSS with relative `url('./fonts/...')` paths that Vite rewrites
and asset-hashes during the consumer's build. The font-family is wired through CSS variables
(`--fable-font-sans`, `--fable-font-display`) so consumers can swap fonts with a tiny CSS
override (declare their own `@font-face` + reassign the variables). Plugin sets
`server.fs.allow` to include the package root so the woff2 assets resolve via Vite's `/@fs/`
route in dev.

### `@oxide/create-fable`

`starter/index.js` is the scaffolder (`npx @oxide/create-fable`). It does a recursive copy
of `starter/main/` into the new project directory, with two file-specific transforms:
rewriting `package.json`'s `"@oxide/fable": "file:../../"` to the published version, and
replacing the title in `index.html`. When the starter changes (e.g. new files like
`vite.config.ts`), they're picked up automatically — no scaffolder change needed unless the
file needs a transform.

### Package exports

- `.` → `./src/index.ts` — browser runtime (`App`, `Markdown`, `FitText`, types)
- `./plugin` → `./src/plugin.ts` — Vite plugin
- `./pdf` → `./scripts/exportPdf.js` — Node-only PDF export (kept separate so importing it
  doesn't pull in React)
- `./styles` → `./styles/src/index.css` — source CSS, processed by consumer Vite

### Code style

Prettier enforces no semicolons, single quotes, 92-col, trailing commas. Imports are
grouped: `~/…` first, then relative (see `.prettierrc`). ESLint (`.eslintrc`) is TS-only
(`*.js` is ignored) and adds `eqeqeq`, `no-param-reassign`, `no-return-assign`, and
unused-var checking with `_`-prefix ignore.
