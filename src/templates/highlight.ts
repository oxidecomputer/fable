/*
 * Shiki highlighting with the Oxide theme, mirroring the design system's
 * asciidoc util. The theme's token colors are `var(--syntax-*)` references
 * resolved by the design system's dark.css (already in the package styles),
 * so highlighted code follows the token palette. Languages load on demand;
 * the Oxide grammars (oxql, p4) are registered up front.
 */
// Plain JSON shapes, deliberately untyped by the design system.
import { oxqlGrammar, p4Grammar, oxideTheme as theme } from '@oxide/design-system/syntax'
import {
  type BundledLanguage,
  type BundledTheme,
  type HighlighterGeneric,
  type LanguageInput,
  bundledLanguages,
  createHighlighter,
} from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null =
  null
const customLanguages = ['oxql', 'p4']
const supportedLanguages = [...Object.keys(bundledLanguages), ...customLanguages]

function getHighlighter() {
  if (!highlighterPromise) {
    const langs: LanguageInput[] = [{ ...oxqlGrammar }, { ...p4Grammar }]
    highlighterPromise = createHighlighter({
      themes: [theme],
      langs,
      // The JS regex engine skips the oniguruma WASM blob, which doesn't
      // survive Vite's dep transforms; `forgiving` falls back to plain
      // tokens for the few grammar patterns it can't translate.
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
  }
  return highlighterPromise
}

/**
 * Highlight plain code to token `<span>`s (no `<pre>`/`<code>` wrapper —
 * `structure: 'inline'`, lines joined with `<br>`), for injection into
 * markup that already provides the block. Unknown languages fall back to
 * plain text in the theme's foreground.
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const h = await getHighlighter()
  const resolved = supportedLanguages.includes(lang) ? lang : 'text'
  if (!h.getLoadedLanguages().includes(resolved)) {
    await h.loadLanguage(resolved as BundledLanguage)
  }
  return h.codeToHtml(code, { lang: resolved, theme, structure: 'inline' })
}
