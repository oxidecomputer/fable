import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Browser, Page } from 'playwright-core'
import * as Y from 'yjs'
import { z } from 'zod'

import * as ops from '../collab/ops'
import { describeSchema } from '../collab/schema-info'
import { parsePage } from '../content/markdown'
import oxideTheme from '../themes/oxide'
import { createLiveblocks, ensureRoom, fetchDocTemplateSources } from './collab'
import { syncDocTemplateScratch } from './doc-template-scan'

/**
 * Fable MCP server: exposes a deck's Liveblocks room to local agents (Claude
 * Code, Codex, …) over stdio. Each tool call fetches the room's Yjs doc via
 * the Liveblocks REST API, applies the operation, and sends the diff update
 * back — connected editors see the change live. Logs go to stderr (stdout
 * carries the MCP protocol).
 *
 * Started by `fable mcp` from a deck directory (reads .env + deck.yml).
 */

const SOURCE_FORMAT = `A slide source is markdown with YAML frontmatter:

---
template: Basic
title: A Journey Through the Cosmos
---

- Markdown body content

The \`template\` key picks the layout; other frontmatter keys are that
template's fields. Long-form markdown fields (text, body, diagram,
description, content, notes) live in the body instead of frontmatter: a lone
markdown body maps to the \`text\` field; multiple long-form fields use fenced
blocks:

::: text
Some markdown
:::

::: notes
Speaker notes
:::

Slides render at a fixed 1920×1080; keep text sparse. Field values are
validated against the template's zod schema in the editor — unknown keys
surface as schema errors.`

export type McpServerOptions = {
  secret: string
  /** Deck (room) used when a tool call omits `deck` — from --room or deck.yml. */
  defaultDeck?: string
  userRoot: string
  /** URL of the local dev server rendering this deck (for screenshots). */
  baseUrl?: string
  /** Regenerates the stylesheet after the Tailwind scratch dir changes. */
  reloadCss?: () => Promise<void>
}

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] }
}

function errorText(value: string) {
  return { content: [{ type: 'text' as const, text: value }], isError: true as const }
}

export async function startMcpServer({
  secret,
  defaultDeck,
  userRoot,
  baseUrl,
  reloadCss,
}: McpServerOptions) {
  const liveblocks = createLiveblocks(secret)

  /** Every deck-scoped tool takes an optional `deck`; fall back to the default. */
  function resolveDeck(deck?: string): string {
    const id = deck ?? defaultDeck
    if (!id) {
      throw new ops.OpError(
        'No deck specified — pass `deck` with a deck id from list_decks',
      )
    }
    return id
  }

  const DECK_ARG = z
    .string()
    .optional()
    .describe('Deck id (= room id). Omit to use the default deck, if configured.')

  const themeCss = await fs
    .readFile(new URL('../../styles/src/index.css', import.meta.url), 'utf8')
    .catch(() => '(stylesheet unavailable)')

  // -- Rendering (screenshots) ------------------------------------------------
  // A headless Chrome tab holds the deck open in ?pdf mode (every slide at
  // exact 1920×1080, connected live to the room), so screenshots always show
  // current state. Uses the system Chrome via playwright-core — no browser
  // download.
  let browser: Browser | null = null
  const renderPages = new Map<string, Page>()

  async function ensureRenderPage(deckId: string): Promise<Page> {
    if (!baseUrl) {
      throw new ops.OpError('Screenshots unavailable: the render server did not start')
    }
    const cached = renderPages.get(deckId)
    if (cached && !cached.isClosed()) return cached
    if (!browser?.isConnected()) {
      const { chromium } = await import('playwright-core')
      const executablePath = process.env.FABLE_CHROME
      try {
        browser = await chromium.launch(
          executablePath ? { executablePath } : { channel: 'chrome' },
        )
      } catch (e) {
        throw new ops.OpError(
          `Could not launch Chrome for screenshots — install Google Chrome or set FABLE_CHROME to a Chromium binary. (${
            e instanceof Error ? e.message.split('\n')[0] : e
          })`,
        )
      }
    }
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })
    const renderPage = await context.newPage()
    await renderPage.goto(`${baseUrl}/?deck=${encodeURIComponent(deckId)}&pdf=true`, {
      waitUntil: 'domcontentloaded',
    })
    renderPages.set(deckId, renderPage)
    return renderPage
  }

  async function fetchDoc(
    deckId: string,
    opts?: { createIfMissing?: boolean },
  ): Promise<Y.Doc> {
    let update: ArrayBuffer
    try {
      update = await liveblocks.getYjsDocumentAsBinaryUpdate(deckId)
    } catch (e: any) {
      const notFound = e?.status === 404 || /not found/i.test(String(e?.message ?? e))
      if (!notFound) throw e
      if (!opts?.createIfMissing) {
        throw new ops.OpError(`Deck "${deckId}" does not exist — see list_decks`)
      }
      // A new deck is just a new room id; writes create it on the spot.
      await ensureRoom(liveblocks, deckId)
      return new Y.Doc()
    }
    const ydoc = new Y.Doc()
    const bytes = new Uint8Array(update)
    if (bytes.byteLength > 0) Y.applyUpdate(ydoc, bytes)
    return ydoc
  }

  /** Fetch → mutate → push the diff so connected editors update live. */
  async function withDoc<T>(
    deckId: string,
    fn: (ydoc: Y.Doc) => T,
    opts?: { write?: boolean },
  ) {
    const ydoc = await fetchDoc(deckId, { createIfMissing: opts?.write })
    const before = Y.encodeStateVector(ydoc)
    const result = fn(ydoc)
    if (opts?.write) {
      await liveblocks.sendYjsBinaryUpdate(deckId, Y.encodeStateAsUpdate(ydoc, before))
    }
    return result
  }

  /**
   * Mirror the room's doc-template sources into the Tailwind scratch dir so
   * their utility classes exist in the generated CSS (dev server hot-updates
   * it, so a following screenshot renders with the new styles).
   */
  async function syncTemplateScratch(deckId: string) {
    try {
      await syncDocTemplateScratch(
        userRoot,
        deckId,
        await fetchDocTemplateSources(liveblocks, deckId),
      )
      await reloadCss?.()
    } catch {
      /* screenshots may miss novel classes; not fatal */
    }
  }

  /** Run a tool body, turning OpError into an agent-readable error result. */
  async function run<T>(fn: () => Promise<T>) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof ops.OpError) return errorText(e.message)
      throw e
    }
  }

  /** Validate fields against a theme template's schema (warnings, not errors). */
  function schemaWarnings(source: string): string[] {
    let data: Record<string, any>
    try {
      data = parsePage(source)
    } catch {
      return []
    }
    const { template, custom_template: _ct, ...fields } = data
    const mod = oxideTheme.templates[template]
    if (!mod?.Schema) return []
    const unwrapped: any =
      (mod.Schema as any)._def?.typeName === 'ZodEffects'
        ? (mod.Schema as any)._def.schema
        : mod.Schema
    if (typeof unwrapped?.strict !== 'function') return []
    const result = unwrapped.strict().safeParse(fields)
    if (result.success) return []
    return result.error.issues.map(
      (i: z.ZodIssue) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    )
  }

  function withWarnings(message: string, source: string): string {
    const warnings = schemaWarnings(source)
    if (warnings.length === 0) return message
    return `${message}\n\nSchema warnings (slide still saved; shown as errors in the editor):\n- ${warnings.join(
      '\n- ',
    )}`
  }

  async function fileTemplateNames(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(userRoot, 'templates'))
      return files
        .filter((f) => /\.(jsx|tsx)$/.test(f))
        .map((f) => f.replace(/\.(jsx|tsx)$/, ''))
    } catch {
      return []
    }
  }

  const server = new McpServer(
    { name: 'fable', version: '0.1.0' },
    {
      instructions: `Fable is a collaborative slide-deck tool. Each deck is a live
Liveblocks room; these tools edit rooms directly — every change appears
immediately in all open editors, alongside human collaborators. ${
        defaultDeck
          ? `The default deck is "${defaultDeck}"; pass \`deck\` to work on another.`
          : 'No default deck is configured — call list_decks and pass `deck` to every deck tool.'
      }

${SOURCE_FORMAT}

Workflow:
0. list_decks to see what exists (or to pick a deck when none is default).
1. list_slides for the deck outline (read_deck to learn the house style in one
   call), then read_slide before editing one.
2. Prefer existing templates — list_templates shows each template's fields and
   a canonical example source. Only create a custom template when no existing
   layout fits: call read_theme first (design tokens, custom utilities), start
   from the closest template's source (read_template), and keep its idioms.
3. update_slide/create_slide validate that the source parses and report schema
   warnings; fix warnings rather than leaving them for the humans in the room.
4. After editing or creating a slide, call screenshot_slide to see the actual
   1920×1080 render and verify it looks right — it also reports any elements
   overflowing the stage, with pixel amounts. Do not assume success from the
   tool result alone.
5. Custom template source compiles in every collaborator's browser. Imports
   are limited to react, zod, and @oxide/fable ({ Markdown, FitText }).
   create_template/update_template compile-validate and reject bad source.
   Tailwind CSS for custom templates is generated from their source (allow a
   beat before screenshotting a brand-new class).

Theme instructions from the deck's theme author:
${oxideTheme.aiInstructions ?? 'none'}`,
    },
  )

  server.tool(
    'list_decks',
    'All decks in the workspace (a deck = a Liveblocks room): id, title, slide count. Creating a deck is just using a new id.',
    {},
    async () =>
      run(async () => {
        const { listDecks } = await import('./collab')
        return text(JSON.stringify(await listDecks(liveblocks), null, 2))
      }),
  )

  server.tool(
    'list_slides',
    'The deck outline: every slide in order with its pageId, template, title, filename, and parse status. Call this first.',
    { deck: DECK_ARG },
    async ({ deck }) =>
      run(async () =>
        text(
          JSON.stringify(
            await withDoc(resolveDeck(deck), (d) => ops.listSlides(d)),
            null,
            2,
          ),
        ),
      ),
  )

  server.tool(
    'read_deck',
    "Read every slide source in order, separated by headers — one call to learn the deck's house style.",
    { deck: DECK_ARG },
    async ({ deck }) =>
      run(async () => {
        const { slides, sources } = await withDoc(resolveDeck(deck), (d) => {
          const { slides } = ops.listSlides(d)
          return { slides, sources: slides.map((sl) => ops.readSlide(d, sl.pageId)) }
        })
        const parts = slides.map(
          (sl, i) =>
            `===== slide ${i + 1}: ${sl.filename} (pageId ${sl.pageId}) =====\n${
              sources[i]
            }`,
        )
        return text(parts.join('\n\n'))
      }),
  )

  server.tool(
    'read_slide',
    "Read a slide's full source (frontmatter + markdown body).",
    { pageId: z.string().describe('Slide id from list_slides'), deck: DECK_ARG },
    async ({ pageId, deck }) =>
      run(async () =>
        text(await withDoc(resolveDeck(deck), (d) => ops.readSlide(d, pageId))),
      ),
  )

  server.tool(
    'update_slide',
    "Replace a slide's source. The source must parse (frontmatter with a template key); schema mismatches are reported as warnings.",
    {
      pageId: z.string().describe('Slide id from list_slides'),
      source: z.string().describe('Full slide source (frontmatter + body)'),
      deck: DECK_ARG,
    },
    async ({ pageId, source, deck }) =>
      run(async () => {
        await withDoc(resolveDeck(deck), (d) => ops.updateSlide(d, pageId, source), {
          write: true,
        })
        return text(withWarnings(`Updated slide ${pageId}.`, source))
      }),
  )

  server.tool(
    'create_slide',
    'Create a new slide from full source. Appends to the deck unless atIndex is given. The filename (export name in content/) defaults to a slug of the title.',
    {
      source: z.string().describe('Full slide source (frontmatter + body)'),
      atIndex: z.number().int().min(0).optional().describe('0-based position'),
      filename: z
        .string()
        .optional()
        .describe('Export filename, e.g. closing.md (defaults to a title slug)'),
      deck: DECK_ARG,
    },
    async ({ source, atIndex, filename, deck }) =>
      run(async () => {
        const created = await withDoc(
          resolveDeck(deck),
          (d) => ops.createSlide(d, source, { atIndex, filename }),
          { write: true },
        )
        return text(
          withWarnings(`Created slide ${created.pageId} (${created.filename}).`, source),
        )
      }),
  )

  server.tool(
    'delete_slide',
    'Delete a slide from the deck.',
    { pageId: z.string(), deck: DECK_ARG },
    async ({ pageId, deck }) =>
      run(async () => {
        await withDoc(resolveDeck(deck), (d) => ops.deleteSlide(d, pageId), {
          write: true,
        })
        return text(`Deleted slide ${pageId}.`)
      }),
  )

  server.tool(
    'move_slide',
    'Move a slide to a new 0-based position.',
    { pageId: z.string(), toIndex: z.number().int().min(0), deck: DECK_ARG },
    async ({ pageId, toIndex, deck }) =>
      run(async () => {
        await withDoc(resolveDeck(deck), (d) => ops.moveSlide(d, pageId, toIndex), {
          write: true,
        })
        return text(`Moved slide ${pageId} to index ${toIndex}.`)
      }),
  )

  server.tool(
    'set_deck_title',
    'Set the deck title (empty string clears it).',
    { title: z.string(), deck: DECK_ARG },
    async ({ title, deck }) =>
      run(async () => {
        await withDoc(resolveDeck(deck), (d) => ops.setDeckTitle(d, title), {
          write: true,
        })
        return text('Deck title updated.')
      }),
  )

  server.tool(
    'list_templates',
    'All available templates: theme built-ins (with their field schemas), file templates from templates/, and custom doc-stored templates in the deck.',
    { deck: DECK_ARG },
    async ({ deck }) =>
      run(async () => {
        const docNames = await withDoc(resolveDeck(deck), (d) => ops.listDocTemplates(d))
        const theme = Object.fromEntries(
          Object.entries(oxideTheme.templates).map(([name, mod]) => [
            name,
            {
              kind: 'theme built-in (read-only)',
              fields: describeSchema(mod.Schema),
              example: mod.example,
            },
          ]),
        )
        const files = Object.fromEntries(
          (await fileTemplateNames()).map((name) => [
            name,
            { kind: `file template (source at templates/${name}.tsx or .jsx)` },
          ]),
        )
        const doc = Object.fromEntries(
          docNames.map((name) => [
            name,
            { kind: 'custom, doc-stored (editable via update_template)' },
          ]),
        )
        return text(JSON.stringify({ ...theme, ...files, ...doc }, null, 2))
      }),
  )

  server.tool(
    'read_template',
    "Read a template's TSX module source — theme built-ins and custom doc-stored templates. Do this before creating a template based on an existing one.",
    { name: z.string().describe('Template name from list_templates'), deck: DECK_ARG },
    async ({ name, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        const docNames = await withDoc(deckId, (d) => ops.listDocTemplates(d))
        if (docNames.includes(name)) {
          return text(await withDoc(deckId, (d) => ops.readDocTemplate(d, name)))
        }
        const themeSource = oxideTheme.templates[name]?.source
        if (themeSource) return text(themeSource)
        for (const ext of ['tsx', 'jsx']) {
          try {
            return text(
              await fs.readFile(path.join(userRoot, 'templates', `${name}.${ext}`), 'utf8'),
            )
          } catch {
            /* try next */
          }
        }
        return errorText(`No template named "${name}" — use list_templates`)
      }),
  )

  server.tool(
    'create_template',
    'Create a custom (doc-stored) template from TSX module source. Must export `Schema` (zod object) and `Template` ({ data }) => JSX; imports limited to react, zod, @oxide/fable. Compile-validated — fix and retry on errors.',
    {
      name: z.string().describe('PascalCase template name (must be new)'),
      source: z.string().describe('Full TSX module source'),
      deck: DECK_ARG,
    },
    async ({ name, source, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        await withDoc(deckId, (d) => ops.createDocTemplate(d, name, source), {
          write: true,
        })
        await syncTemplateScratch(deckId)
        return text(`Created template "${name}" — usable in slides via template: ${name}.`)
      }),
  )

  server.tool(
    'update_template',
    "Replace a custom (doc-stored) template's TSX source. Built-ins are read-only — copy them with create_template instead. Compile-validated.",
    {
      name: z.string(),
      source: z.string().describe('Full TSX module source'),
      deck: DECK_ARG,
    },
    async ({ name, source, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        await withDoc(deckId, (d) => ops.updateDocTemplate(d, name, source), {
          write: true,
        })
        await syncTemplateScratch(deckId)
        return text(`Updated template "${name}".`)
      }),
  )

  server.tool(
    'read_theme',
    "The theme's design vocabulary: its design.md (tokens, typography, principles), the theme author's instructions, and the slide stylesheet. Read before writing custom templates.",
    {},
    async () =>
      run(async () =>
        text(
          `Theme: ${oxideTheme.name}\n\nTheme author instructions:\n${
            oxideTheme.aiInstructions ?? 'none'
          }\n\n${
            oxideTheme.designDoc
              ? `Design document:\n\n${oxideTheme.designDoc}`
              : 'No design document.'
          }\n\nSlide stylesheet (styles/src/index.css — custom utilities like large-title/body-md/page-padding are defined here; the design system's semantic tokens and Tailwind v4 utilities also exist):\n\n${themeCss}`,
        ),
      ),
  )

  server.tool(
    'add_asset',
    "Write a static asset (image etc.) into the deck's public/ directory and get back the path to reference from slides (e.g. image: /diagram.png).",
    {
      filename: z.string().describe('Asset filename, e.g. diagram.png'),
      base64: z.string().describe('File contents, base64-encoded'),
    },
    async ({ filename, base64 }) =>
      run(async () => {
        const name = path.basename(filename)
        if (!/^[\w-]+\.(png|jpe?g|gif|svg|webp|avif|mp4|woff2?)$/i.test(name)) {
          return errorText(
            'Filename must be simple (letters/digits/-/_) with an image, video, or font extension',
          )
        }
        const buf = Buffer.from(base64, 'base64')
        if (buf.byteLength === 0) return errorText('Empty file')
        if (buf.byteLength > 20 * 1024 * 1024) return errorText('File exceeds 20 MB')
        const publicDir = path.join(userRoot, 'public')
        await fs.mkdir(publicDir, { recursive: true })
        await fs.writeFile(path.join(publicDir, name), buf)
        return text(
          `Saved ${name} (${buf.byteLength} bytes) — reference it from slides as /${name}`,
        )
      }),
  )

  server.tool(
    'screenshot_slide',
    'Render a slide from the live room at 1920×1080 and return it as an image. Use after edits to verify the slide actually looks right.',
    { pageId: z.string().describe('Slide id from list_slides'), deck: DECK_ARG },
    async ({ pageId, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        const { slides } = await withDoc(deckId, (d) => ops.listSlides(d))
        const index = slides.findIndex((s) => s.pageId === pageId)
        if (index === -1) {
          return errorText(`No slide with pageId "${pageId}" — use list_slides`)
        }
        const page = await ensureRenderPage(deckId)
        await page.waitForFunction(
          (n) => document.querySelectorAll('main').length >= n,
          slides.length,
          { timeout: 20_000 },
        )
        await page.evaluate(() => document.fonts.ready)
        // Let a just-pushed edit propagate to the render tab and images settle.
        await page.waitForTimeout(800)
        const el = page.locator('main').nth(index)
        await el.scrollIntoViewIfNeeded()
        const buf = await el.screenshot({ type: 'png' })

        // Machine-readable geometry: elements poking outside the 1920×1080
        // stage, so the agent can converge on measurements instead of
        // eyeballing the image.
        const overflows = await page.evaluate((i) => {
          const main = document.querySelectorAll('main')[i]
          if (!main) return []
          const stage = main.getBoundingClientRect()
          const out: string[] = []
          for (const node of main.querySelectorAll('*')) {
            const r = node.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            const over = {
              left: Math.round(stage.left - r.left),
              right: Math.round(r.right - stage.right),
              top: Math.round(stage.top - r.top),
              bottom: Math.round(r.bottom - stage.bottom),
            }
            const dirs = Object.entries(over)
              .filter(([, v]) => v > 1)
              .map(([k, v]) => `${k} by ${v}px`)
            if (dirs.length > 0) {
              const cls = (node as HTMLElement).className
              const label = `${node.tagName.toLowerCase()}${
                typeof cls === 'string' && cls
                  ? '.' + cls.split(/\s+/).slice(0, 3).join('.')
                  : ''
              }`
              out.push(`${label} overflows ${dirs.join(', ')}`)
            }
            if (out.length >= 8) break
          }
          return out
        }, index)

        const geometry =
          overflows.length === 0
            ? 'No elements overflow the 1920×1080 stage.'
            : `OVERFLOW — content extends beyond the stage:\n- ${overflows.join('\n- ')}`

        return {
          content: [
            {
              type: 'image' as const,
              data: buf.toString('base64'),
              mimeType: 'image/png',
            },
            {
              type: 'text' as const,
              text: `Slide ${index + 1}/${slides.length} (template: ${
                slides[index].template
              }), rendered at 1920×1080. ${geometry}`,
            },
          ],
        }
      }),
  )

  server.tool(
    'delete_template',
    'Delete a custom (doc-stored) template. Slides still referencing it will show a missing-template error.',
    { name: z.string(), deck: DECK_ARG },
    async ({ name, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        await withDoc(deckId, (d) => ops.deleteDocTemplate(d, name), { write: true })
        await syncTemplateScratch(deckId)
        return text(`Deleted template "${name}".`)
      }),
  )

  await server.connect(new StdioServerTransport())
  console.error(
    `[fable-mcp] serving decks on stdio${
      defaultDeck ? ` (default: "${defaultDeck}")` : ''
    }`,
  )

  return {
    async dispose() {
      await browser?.close().catch(() => {})
    },
  }
}
