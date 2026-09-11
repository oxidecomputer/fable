import type { TemplateModule } from '../../Page'
import * as Basic from '../../templates/Basic'
import BasicSource from '../../templates/Basic.tsx?raw'
import * as Cover from '../../templates/Cover'
import CoverSource from '../../templates/Cover.tsx?raw'
import * as FullPageDiagram from '../../templates/FullPageDiagram'
import FullPageDiagramSource from '../../templates/FullPageDiagram.tsx?raw'
import * as FullPageImage from '../../templates/FullPageImage'
import FullPageImageSource from '../../templates/FullPageImage.tsx?raw'
import * as HalfPage from '../../templates/HalfPage'
import HalfPageSource from '../../templates/HalfPage.tsx?raw'
import * as TitleMultiColumn from '../../templates/TitleMultiColumn'
import TitleMultiColumnSource from '../../templates/TitleMultiColumn.tsx?raw'
import type { Theme } from '../../theme'
import designDoc from './design.md?raw'

// Sources ride along so the editor can fork a built-in into a doc-stored
// custom template; examples are canonical page sources agents and humans can
// pattern-match against.
function withSource(mod: unknown, source: string, example: string): TemplateModule {
  return { ...(mod as TemplateModule), source, example }
}

const BASIC_EXAMPLE = `---
template: Basic
title: A Journey Through the Cosmos
---

- In the _vastness of space_, time and distance are but mere illusions
- They are **united** in their quest for knowledge

Paragraphs and \`\`\`fenced code blocks\`\`\` work here too.
`

const COVER_EXAMPLE = `---
template: Cover
title: '*The Unknown:* <br> Unveiling the Wonders <br> of the Universe'
---
`

const MULTI_EXAMPLE = `---
template: TitleMultiColumn
title: In the Vastness of Space
text:
  - First column of short markdown text.
  - Second column, parallel in weight to the first.
  - Third column closes the thought.
---
`

const DIAGRAM_EXAMPLE = `---
template: FullPageDiagram
title: System Overview
diagram_font_size: 28px
---

::: diagram
+--------+     +--------+
| client | --> | server |
+--------+     +--------+
:::
`

const IMAGE_EXAMPLE = `---
template: FullPageImage
image: /large-placeholder.svg
---
`

const HALF_EXAMPLE = `---
template: HalfPage
title: Mr. Whiskers
image: /large-placeholder.svg
---

He sat atop the garden wall, his fur ruffled by the autumn breeze.
`

export const oxideTheme: Theme = {
  name: 'oxide',
  designDoc,
  templates: {
    Basic: withSource(Basic, BasicSource, BASIC_EXAMPLE),
    Cover: withSource(Cover, CoverSource, COVER_EXAMPLE),
    FullPageDiagram: withSource(FullPageDiagram, FullPageDiagramSource, DIAGRAM_EXAMPLE),
    FullPageImage: withSource(FullPageImage, FullPageImageSource, IMAGE_EXAMPLE),
    HalfPage: withSource(HalfPage, HalfPageSource, HALF_EXAMPLE),
    TitleMultiColumn: withSource(TitleMultiColumn, TitleMultiColumnSource, MULTI_EXAMPLE),
  },
  aiInstructions: `You are helping edit a slide deck built with the Oxide theme.

Template idioms:
- "Cover" for the title slide, section breaks, and closing/thanks slides — a single short markdown title, italics for emphasis.
- "Basic" for standard text slides: a title plus a markdown body (lists, paragraphs, fenced code blocks all work).
- "TitleMultiColumn" when comparing or grouping 2–4 short parallel points.
- "HalfPage" to pair text with an image or an ASCII diagram; "FullPageImage" / "FullPageDiagram" when the visual carries the slide.

Style:
- Slides are fixed 1920×1080; keep text sparse — a slide should make one point.
- Text fields are markdown: _italics_, **bold**, \`code\`, and <br> for manual title breaks.
- Prefer editing an existing slide's fields over recreating it. Prefer existing templates; only create a custom template when no existing one fits the layout, and start it from the closest template's source.
- The theme sits on the Oxide design system (dark-first, Swiss type, OKLCH tokens) — read_theme returns its full design.md and the stylesheet. Slide vocabulary: layout \`page-padding\`; typography \`large-title\` (already \`text-raise\`), \`body-md\`, \`body-sm\`; colors are semantic — \`text-raise/default/secondary/tertiary\`, \`text-accent\` (green, use sparingly), surfaces \`bg-default/raise/accent-secondary\`, strokes \`border-default\`. \`_italics_\` in markdown render in the accent color. Uppercase mono labels use \`text-mono-sm\` etc. Hierarchy comes from tone, not weight. Render markdown fields through the Markdown component, passing field=\"<field>\" so the text is directly editable on the canvas. Standard Tailwind utilities (grid, flex, gap, arbitrary values) also work in custom templates — their CSS is generated from the template source.`,
}

export default oxideTheme
