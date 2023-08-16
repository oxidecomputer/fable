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
});
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
````

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

Custom templates consist of:

1. A template schema that validates whether the page's content matches the rendering
   requirements of the template.
2. A React component that handles the page content provided by the user.

Refer to this
[starter example](https://github.com/oxidecomputer/fable/blob/main/starter/main/templates/Example.jsx)
to create your own custom templates.

### Template Utilities

_Markdown:_ Content enclosed within is parsed and rendered as Markdown.

_FitText:_ Automatically resizes overflowing text to fit within its container.

> **Info**: Currently not in use, needs improvements

## Stying

Fable supports [Tailwind CSS](https://tailwindcss.com/) out of the box. You can also use the
`styles.css` file.
