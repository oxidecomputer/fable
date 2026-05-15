# Fable

> **Warning**: Fable is not much more than an internal experiment in a type of deck
> generator. It won't offer a comprehensive feature set or the robustness of a
> fully-developed library. But it aims to provide a flexible and intuitive tool for
> presentation creation. We greatly appreciate feedback, suggestions, and best of all
> contributions.

Fable is a deck generator that looks to offer an authoring experience as effortless as
markdown presentation libraries while providing the flexibility to create more varied
layouts. It utilizes TOML templates and content schema validation (via
[zod](https://zod.dev/)) to ensure content accuracy and format adherence.

![CleanShot 2023-06-19 at 19 07 36](https://github.com/oxidecomputer/fable/assets/4020798/f22a3bc9-9954-4846-849c-daa1878b3278)

## Key Features

- Schema-based validation for templates
- Customizable page templates
- Support for a wide variety of content formats (Markdown, code snippets, images) and can be
  extended to support anything else
- Seamless export to PDF using [`Puppeteer`](https://pptr.dev/)
- Built-in Tailwind CSS support

## How It Works

Specify a page template along with its own content schema (using [`zod`](https://zod.dev/))
to validate the content and fields in the TOML file.

```jsx
export const Schema = z.object({
  title: z.string().optional,
  text: z.string(),
})
```

```toml
[[pages]]
template = "Basic"
title = "A Journey Through the Cosmos"
text = """
- In the _vastness of space_, time and distance are but mere illusions
    - Worlds exist beyond our wildest imaginations
        - On these worlds, _beings of all shapes and sizes_ dwell
- With societies and cultures _as diverse as the stars_ that light up the skies above
- They are **united** in their quest for knowledge and understanding
- The universe itself is our teacher, and its secrets our endless source of inspiration
"""
```

The `template` attribute in your TOML file should correspond to the template component name.
Fable provides
[several built-in templates](https://github.com/oxidecomputer/fable/tree/main/src/templates),
but custom templates can also be created. Any design you can produce with a React layout can
be incorporated into your presentation.

This means you're not relying on the library to support any type of content, it can be
easily extended to support things like Latex, AsciiMath, AsciiDoc by just installing any
prerequisites and handling it directly in a new layout.

## Getting Started

Create a new presentation with `npx @oxide/create-fable@latest`.

## Export to PDF

To generate a PDF version of your presentation, run `npm run export-pdf`.

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

Unknown TOML keys are caught as schema errors (the schema is parsed in strict mode), so
typos surface as an in-page error table instead of silently rendering blank content.

### Template Utilities

Importable from `@oxide/fable`:

- `Markdown` — parses its `content` prop as Markdown.
- `FitText` — resizes overflowing text to fit its container.

## Styling

Fable supports [Tailwind CSS](https://tailwindcss.com/) out of the box — the Vite plugin
wires up Tailwind via PostCSS and scans both the package's built-in templates and your
project's `templates/` directory. No `tailwind.config` or `postcss.config` needed.

### Fonts

Inter and Inter Display ship with the package, so a fresh project renders correctly with no
setup. To swap fonts, drop a CSS file (e.g. `public/styles.css`) into your project and
override the CSS variables:

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

Link it from `index.html` (`<link rel="stylesheet" href="/styles.css">`) and the overrides
take effect.
