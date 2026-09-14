import type { TemplateModule } from '../../Page'
import type { Theme } from '../../theme'
import { GridOverlay } from './GridOverlay'
import designDoc from './design.md?raw'
import * as templateExports from './runtime'
import * as Cover from './templates/Cover'
import CoverSource from './templates/Cover.tsx?raw'
import * as Divider from './templates/Divider'
import DividerSource from './templates/Divider.tsx?raw'
import * as FullImage from './templates/FullImage'
import FullImageSource from './templates/FullImage.tsx?raw'
import * as Quote from './templates/Quote'
import QuoteSource from './templates/Quote.tsx?raw'
import * as Stat from './templates/Stat'
import StatSource from './templates/Stat.tsx?raw'
import * as StatPie from './templates/StatPie'
import StatPieSource from './templates/StatPie.tsx?raw'
import * as StatRows from './templates/StatRows'
import StatRowsSource from './templates/StatRows.tsx?raw'
import * as Text from './templates/Text'
import TextSource from './templates/Text.tsx?raw'
import * as TextImage from './templates/TextImage'
import TextImageSource from './templates/TextImage.tsx?raw'
import * as TitleColumns from './templates/TitleColumns'
import TitleColumnsSource from './templates/TitleColumns.tsx?raw'
import * as TitleText from './templates/TitleText'
import TitleTextSource from './templates/TitleText.tsx?raw'

// Sources ride along so the editor can fork a built-in into a doc-stored
// custom template; examples are canonical page sources agents and humans can
// pattern-match against, and descriptions say when to reach for each one.
function withSource(
  mod: unknown,
  source: string,
  example: string,
  description: string,
): TemplateModule {
  return { ...(mod as TemplateModule), source, example, description }
}

const COVER_EXAMPLE = `---
template: Cover
title: |-
  Welcome
  to OxCon
---
`

const DIVIDER_EXAMPLE = `---
template: Divider
title: |-
  A section title
  over two lines
---
`

const TEXT_EXAMPLE = `---
template: Text
---

A short paragraph of body copy with the **key phrase bolded** so the
takeaway reads at a glance.

A blank line starts a new paragraph; a single newline
renders as a line break.
`

const QUOTE_EXAMPLE = `---
template: Quote
name: Firstname Lastname
role: Role & Team
---

A short pull quote, one or two sentences. No quote marks —
they're added automatically.
`

const TITLE_TEXT_EXAMPLE = `---
template: TitleText
title: |-
  A display title
  over two lines
---

- A top-level bullet point in the body
- **Bold the lead phrase** and keep the rest plain
  - Nested bullets work too
`

const TEXT_IMAGE_EXAMPLE = `---
template: TextImage
image: /large-placeholder.svg
footnotes:
  - A short footnote rendered bottom-left.
  - Footnotes are numbered automatically.
---

Body copy beside the image with the **key phrases bolded** so the
takeaway reads at a glance.

A second paragraph after a blank line. Set flip: true to put the
image on the left.
`

const TITLE_COLUMNS_EXAMPLE = `---
template: TitleColumns
title: |-
  A display title
  over two lines
image: /large-placeholder.svg
columns:
  - |-
    First column: a few sentences of parallel supporting copy along
    the bottom left, under the title.
  - |-
    Second column: keep the columns roughly the same length so they
    read as a pair.
---
`

const STAT_EXAMPLE = `---
template: Stat
stat: 4.49%
---

A short takeaway below the stat,
a line or two at most
`

const STAT_ROWS_EXAMPLE = `---
template: StatRows
rows:
  - stat: 60k
    label: "**Lead phrase:** the rest of the label stays plain"
  - stat: 2%
    label: "**Parallel structure:** rows read best when labels match shape"
  - stat: HPC
    label: "**Two to four rows:** fit comfortably on the slide"
---
`

const STAT_PIE_EXAMPLE = `---
template: StatPie
stat: +3.76M
percent: 58
legend:
  - "**First legend entry:** bold the lead phrase"
  - "**Second legend entry:** keep entries short"
---

Supporting copy under the stat on the left; the pie chart
renders the percent field on the right.
`

const FULL_IMAGE_EXAMPLE = `---
template: FullImage
image: /large-placeholder.svg
caption: |-
  An optional caption bottom-left,
  one or two short lines.
---
`

/**
 * OXCON 09_2026 — a fork of the Oxide theme sharing the conference displays'
 * language: the dual grid, the heatmap shader background, and silkscreen
 * micrographics. Starts from a clean slate template-wise; the stock Oxide
 * templates will return as they're reworked onto the grid.
 */
export const oxcon26Theme: Theme = {
  name: 'oxcon26',
  templateExports,
  gridOverlay: GridOverlay,
  designDoc,
  templates: {
    Cover: withSource(
      Cover,
      CoverSource,
      COVER_EXAMPLE,
      'Deck opener/welcome: a huge accent title over the 0X reverse. Title only, one per deck — for section breaks use Divider.',
    ),
    Divider: withSource(
      Divider,
      DividerSource,
      DIVIDER_EXAMPLE,
      'Section divider: a big green title over the shader. Title only — no body copy.',
    ),
    FullImage: withSource(
      FullImage,
      FullImageSource,
      FULL_IMAGE_EXAMPLE,
      'Full-bleed image with an optional caption; when the visual is the slide. For text beside an image use TextImage.',
    ),
    Quote: withSource(
      Quote,
      QuoteSource,
      QUOTE_EXAMPLE,
      'Pull quote over the shader, optional name/role attribution. Quote marks are added automatically — don’t include them.',
    ),
    Stat: withSource(
      Stat,
      StatSource,
      STAT_EXAMPLE,
      'One huge stat with a short takeaway below. A single number only — for several use StatRows; for a proportion use StatPie.',
    ),
    StatPie: withSource(
      StatPie,
      StatPieSource,
      STAT_PIE_EXAMPLE,
      'Big accent stat and supporting text left, pie chart right with legend. Only when a share-of-whole proportion matters.',
    ),
    StatRows: withSource(
      StatRows,
      StatRowsSource,
      STAT_ROWS_EXAMPLE,
      'Stacked stat/label rows with hairline separators; for 2–4 related stats. For one big number use Stat.',
    ),
    Text: withSource(
      Text,
      TextSource,
      TEXT_EXAMPLE,
      'Body-copy slide: one flowing markdown field, key phrases bolded. The default for prose without a heading — with one, use TitleText.',
    ),
    TextImage: withSource(
      TextImage,
      TextImageSource,
      TEXT_IMAGE_EXAMPLE,
      'Half text / half image with optional numbered footnotes; flip puts the image on the left.',
    ),
    TitleColumns: withSource(
      TitleColumns,
      TitleColumnsSource,
      TITLE_COLUMNS_EXAMPLE,
      'Display title with an image right and short parallel text columns bottom-left; for grouped points with a visual.',
    ),
    TitleText: withSource(
      TitleText,
      TitleTextSource,
      TITLE_TEXT_EXAMPLE,
      'Display title with markdown body below — bullet lists (nested too) work. The default for prose under a heading.',
    ),
  },
  aiInstructions: `You are helping edit a slide deck built with the OXCON 26 theme (a fork of the Oxide theme for the OXCON conference).

Template idioms:
- "Cover" for the deck's opening/welcome slide: a huge accent-green title (deck-display-lg) over the full-height 0X reverse — the shader texture shows through the mark's bars. No other fields.
- "Divider" for section/title dividers: a big green title over the shader with grid-line texture and the mono header band (label defaults to OXCON_26; the slide number renders automatically).
- "Text" for body-copy slides: a light slide with the header band and large flowing markdown in the text field; use **strong** on the phrases that matter (renders medium near-black against the grey body).
- "Quote" for pull quotes: a big white quote (marks added automatically) over the shader with silkscreen texture, with optional name/role attribution bottom-left.
- "TitleText" for a display title with body markdown below — bullet lists (nested too) work in the text field; use **strong** on the lead phrases and plain text for grey asides.
- "TextImage" for half text / half image: large body text (bold the key phrases) with optional numbered footnotes (footnotes array) bottom-left, image filling the other half rows 2 to the bottom. flip: true puts the image on the left.
- "TitleColumns" for a display title with an image in the right 4 columns and text columns (columns array, usually two) along the bottom left.
- "Stat" for one huge stat over the faint cell grid with a grey display takeaway in the text field below.
- "StatRows" for stacked stat rows: a rows array of { stat, label } pairs, hairline separators between bands; bold the label lead ("**Unified interface:** everything…").
- "StatPie" for a big accent stat and supporting text left, a pie (percent field, 0–100) flush right with legend entries (legend array, bold lead) on hairlines below. Defaults dark.
- "FullImage" for a full-bleed image with an optional caption bottom-left. variant picks the overlay text color (dark = light text, the default).
- Every new-style template takes variant: light | dark (TitleText/TextImage/TitleColumns/Stat/StatRows default light; StatPie/FullImage default dark).
- Line breaks in any text field: a newline renders as a line break (<br> also works); a blank line starts a new paragraph (paragraph spacing comes from the deck-text-* classes).

Choosing a template (in order):
1. If the content fits an existing template's fields, use it — even imperfectly.
2. For tone or arrangement tweaks, reach for the template's variant/flip fields before anything else.
3. If you need the same layout with different content, it's the same template with different data — never a new template.
4. Only when no existing layout fits the structure, fork the closest template's source (read_template) into a doc-stored template and keep its idioms.
5. Never create a custom template for one slide's content that Text or TitleText can express in markdown.

Style:
- Slides are fixed 1920×1080 and everything sits on the theme's dual grid: 12 layout columns over a 77×22 ASCII cell grid (read_theme returns the full design doc).
- Dark-first, sparse, Swiss: one idea per slide, hierarchy from tone (text-raise / text-secondary / text-tertiary) not weight, text-accent green only sparingly.
- Type ramp: deck-mono-sm/-md (GT Mono, uppercase) and deck-text-xs/-sm/-md/-lg, deck-display-sm/-md/-lg (Suisse) — grid-registered line heights, safe to put straight on a Markdown component. Prefer these classes over ad-hoc text sizes; read_theme has the full table.
- Tone-aware color roles: deck-strong (titles/stats), deck-muted (body/captions/legends), deck-faint (footnote numbers, asides), deck-accent (green on dark, near-black on light). They flip automatically with the slide's tone, so use them instead of hard-coding text-raise/text-neutral-* per variant; declare the variant field with the toneVariant schema (importable from @oxide/fable) and pass it to Slide as tone={data.variant ?? 'light'}. Hairlines use background: var(--deck-hairline).
- Custom templates compose the theme's building blocks, all importable from @oxide/fable: Slide (stage shell, tone dark/light), DeckText (ramp-styled text seated on the grid by column/row), HeaderBand, ShaderBackground (animated heatmap backdrop), Silkscreen (generative PCB micrographics), GridLines (cell hairline texture), plus Markdown and FitText. Render markdown fields through Markdown with field="<field>" so text is editable on the canvas. Start from an existing template's source — they're all a Slide with layers plus DeckText blocks.`,
}

export default oxcon26Theme
