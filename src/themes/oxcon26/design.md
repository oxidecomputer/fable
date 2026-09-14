# OXCON 26 theme

A fork of the Oxide theme for OXCON 09_2026 decks, sharing the display language of the
conference site and live displays (oxcon26): everything is seated on a dual grid, backed by
the heatmap shader and PCB-silkscreen micrographics.

## The dual grid

Two registered grids over the fixed 1920×1080 stage (`grid.ts`, computed once as
`stageGrid`):

- **Layout grid** — 12 columns, 3 cells of margin, 1-cell gutters.
- **Cell grid** — 77 ASCII columns × 22 rows. One cell is `u ≈ 24.94px` wide and
  `cellH ≈ 49.09px` tall. Gutters and margins are whole cells, so the two grids register
  exactly.

All placement is absolute against this grid: `place(stageGrid, { col, cell, row })` seats a
capsize-trimmed text block's baseline on a cell row. Negative `col`/`row` count from the
right/bottom. Text is trimmed with `useCapsize({ fontFamily: 'suisse-intl', … })` so cap top
and baseline are the block's true edges, and tracked with `trackingEm(fontSize)` (the design
system's optical curve).

ASCII layers use GT America Mono, whose uniform 620/1000 advance lets the grid treat every
glyph as one cell: size them with `monoFontSize(stageGrid, cells)` and zero the
letter-spacing, or the glyphs drift off the grid.

## Reusable components

- **`Slide`** — the stage shell: fills the slide, clips overflow, sets the tone. `dark`
  (default) is the theme surface; `light` is `.oxcon-light` — neutral-100 surface, grey body
  text, and `**strong**` spans in medium near-black.
- **`DeckText`** — a ramp-styled text block seated on the dual grid: pass a ramp `style`
  (`display-lg`, `text-md`, …), a layout `col` and cell `row`, and it applies the deck class
  plus a capsize trim so `anchor="baseline"` (default) seats the last baseline on the row
  and `anchor="top"` seats the first cap top. Width defaults to running to the content
  area's right edge.

- **`ShaderBackground`** — the heatmap WebGL shader (adapted from Paper Shaders) as a
  full-stage background: rising blob field, edge glow, a slow visibility/dim breathing
  cycle, mapped through a neutral 3-stop gradient. Override any param via `params` (see
  `defaultShaderParams`).
- **`Silkscreen`** — generative PCB-silkscreen micrographics (reference designators,
  fiducials, callouts) drawn as real GT Mono text on the cell grid at half-cell density,
  constantly churning. `stamp` pins lines bottom-right (defaults to the OXCON date stamp).

- **`HeaderBand`** — the mono header band: a label (default `OXCON_26`) at the left margin
  and the slide number (from the deck, override with `right`) at the right, both in
  deck-mono-sm on the row-1.5 baseline.
- **`GridLines`** — cell-grid hairlines as texture. A `cull` function decides which segments
  to drop (return true to drop); the default keeps vertical lines in the outer thirds of the
  stage (the middle stays clear for content) and horizontal lines in the bottom third.
  `cull={() => false}` draws the full grid. Edge-culled like the site's overlay.
- **`oxconAssets`** — theme asset URLs: `fullHeightOx` (a 1920×1080 dark reverse of the 0X
  mark — layer it over `ShaderBackground` and the texture shows only through the mark's
  bars, as on the Cover template) and `wordmark` (the 273×78 grey Oxide wordmark).

All of these are exported from `@oxide/fable`, so custom doc-stored templates can use them
too.

## Type ramp

Deck text styles (`styles.css`), one class per Figma `deck/*` style, plus in-between steps
(marked "tween") that fill the ramp's big gaps so `DeckText`'s autofit can step down gently.
Line heights are exact cell multiples of the grid (`--grid-cell` = 1080/22 ≈ 49.09px), so
flowed text keeps the vertical rhythm; put the class on the text block (or directly on a
`Markdown` component — paragraph spacing is built in).

| class                | font        | size  | line height | tracking | notes            |
| -------------------- | ----------- | ----- | ----------- | -------- | ---------------- |
| `deck-mono-sm`       | GT Mono     | 20px  | ½ cell      | +4%      | uppercase        |
| `deck-mono-md`       | GT Mono     | 30px  | 1 cell      | +4%      | uppercase        |
| `deck-text-xs`       | Suisse Intl | 20px  | ½ cell      | −1.5%    |                  |
| `deck-text-sm`       | Suisse Intl | 28px  | ⅔ cell      | −1.5%    | ¶ spacing ½ cell |
| `deck-text-md`       | Suisse Intl | 40px  | 1 cell      | −1.5%    | ¶ spacing ½ cell |
| `deck-text-lg`       | Suisse Intl | 54px  | 1⅓ cells    | −2%      | ¶ spacing ½ cell |
| `deck-text-xl`       | Suisse Intl | 68px  | 1⅔ cells    | −2.5%    | tween            |
| `deck-display-sm`    | Suisse Intl | 90px  | 2 cells     | −3%      | ¶ spacing 45px   |
| `deck-display-sm-md` | Suisse Intl | 110px | 2½ cells    | −3%      | tween            |
| `deck-display-md`    | Suisse Intl | 135px | 3 cells     | −3%      |                  |
| `deck-display-md-lg` | Suisse Intl | 180px | 4 cells     | −3.5%    | tween            |
| `deck-display-lg`    | Suisse Intl | 245px | 5 cells     | −4%      |                  |

These style flowed text; for baseline-seated blocks keep using `useCapsize` + `place` (the
ramp's sizes and line heights are the same numbers those produce — e.g. the Title template's
capsize title is `deck-display-md`'s 135/147).

## Type & color

Suisse Intl (300/400/500) for display text, GT America Mono for marks and ASCII layers.
Dark-first: slides sit on `#080f11`; text uses the semantic tokens (`text-raise` for titles,
`text-secondary`/`text-tertiary` for support, `text-accent` sparingly). Silkscreen layers
rest at neutral-800 around 60% opacity — texture, not content.
