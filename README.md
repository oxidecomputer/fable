# Fable

> **Warning**: Fable is not much more than an internal experiment in a type of deck
> generator. It won't offer a comprehensive feature set or the robustness of a
> fully-developed library. But it aims to provide a flexible and intuitive tool for
> presentation creation. We greatly appreciate feedback, suggestions, and best of all
> contributions.

Fable is a deck generator that aims to offer an authoring experience as effortless as
markdown presentation libraries while providing the flexibility to create more varied
layouts. Pages are Markdown files with YAML frontmatter, and templates use
[zod](https://zod.dev/) schemas to validate content and surface typos as in-page errors.

![CleanShot 2023-06-19 at 19 07 36](https://github.com/oxidecomputer/fable/assets/4020798/f22a3bc9-9954-4846-849c-daa1878b3278)

## Key Features

- Single-command CLI: `fable dev` / `fable build` — no `vite.config`, no `index.html`, no
  `tailwind.config`
- Schema-validated page templates
- Custom React templates auto-discovered from a `templates/` directory
- Built-in Tailwind CSS support

## How It Works

A page is a Markdown file with YAML frontmatter that picks a template:

```md
---
template: Basic
title: A Journey Through the Cosmos
---

- In the _vastness of space_, time and distance are but mere illusions
- With societies and cultures _as diverse as the stars_ that light up the skies above
- They are **united** in their quest for knowledge and understanding
```

Pages are listed in order in `content/deck.yml`:

```yaml
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

```sh
npx @oxide/create-fable@latest
cd my-deck
npm install
npm run dev
```

A project only needs a `content/` directory (and optionally `templates/` and `public/`).
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

Unknown frontmatter keys are caught as schema errors (the schema is parsed in strict mode),
so typos surface as an in-page error table instead of silently rendering blank content.

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

## CLI

```
fable dev     Start the dev server in the current directory
fable build   Build a production deck into ./dist
```
