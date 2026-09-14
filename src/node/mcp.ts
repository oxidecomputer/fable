import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Browser, Page } from 'playwright-core'
import * as Y from 'yjs'
import { z } from 'zod'

import { createTemplateCompiler } from '../collab/compile'
import { readTemplateSources } from '../collab/doc'
import * as ops from '../collab/ops'
import { describeSchema } from '../collab/schema-info'
import { parsePage } from '../content/markdown'
import type { TemplateMap } from '../model'
import { resolveTemplates } from '../templates/registry'
import { validatePageFields } from '../templates/validation'
import type { Theme } from '../theme'
import {
  createLiveblocks,
  ensureRoom,
  fetchDocTemplateSources,
  uploadRoomFile,
} from './collab'
import { syncDocTemplateScratch } from './doc-template-scan'
import { startMcpHeartbeat } from './mcp-heartbeat'

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

Field values are markdown; a newline renders as a line break (<br> also
works), and a blank line starts a new paragraph.

Slides render at a fixed 1920×1080; keep text sparse. Field values are
validated against the template's zod schema in the editor — unknown keys
surface as schema errors.

Image fields accept a URL, a path under the deck's public/ directory
(e.g. /diagram.png), or a room-stored file ref (fable:<fileId> — upload with
upload_file from a local path, a URL, or inline base64). Room-stored files
travel with the deck and need no local directory, so prefer upload_file over
add_asset.`

export type McpServerOptions = {
  secret: string
  /** Deck (room) used when a tool call omits `deck` — from --room or deck.yml. */
  defaultDeck?: string
  userRoot: string
  theme: Theme
  /** Uses Vite's module loader, matching the browser's file template imports. */
  loadFileTemplates: () => Promise<TemplateMap>
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

export async function createMcpServer({
  secret,
  defaultDeck,
  userRoot,
  baseUrl,
  reloadCss,
  theme: deckTheme,
  loadFileTemplates,
}: McpServerOptions) {
  const liveblocks = createLiveblocks(secret)
  const compiler = createTemplateCompiler(deckTheme.templateExports)
  // The editor's sidebar MCP indicator reads this via the dev middleware.
  const stopHeartbeat = startMcpHeartbeat(userRoot)

  async function templateRegistry(ydoc: Y.Doc) {
    return resolveTemplates(
      {
        theme: deckTheme.templates,
        files: await loadFileTemplates(),
        document: readTemplateSources(ydoc),
      },
      compiler.compileCached,
    )
  }

  // Unlike document commands, the agent adapter accepts only evaluated,
  // valid modules. This runs top-level code in Node; rendering is verified
  // separately by screenshot_slide in the browser.
  function validateTemplateSource(source: string) {
    try {
      compiler.compileCached(source)
    } catch (err) {
      throw new ops.OpError(
        `Template evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

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
    fn: (ydoc: Y.Doc) => T | Promise<T>,
    opts?: { write?: boolean },
  ) {
    const ydoc = await fetchDoc(deckId, { createIfMissing: opts?.write })
    try {
      const before = Y.encodeStateVector(ydoc)
      const result = await fn(ydoc)
      if (opts?.write) {
        await liveblocks.sendYjsBinaryUpdate(deckId, Y.encodeStateAsUpdate(ydoc, before))
      }
      return result
    } finally {
      ydoc.destroy()
    }
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

  function withWarnings(
    message: string,
    source: string,
    registry: ReturnType<typeof resolveTemplates>,
  ): string {
    const data = parsePage(source)
    const template = registry.templates[data.template]
    const warnings = template
      ? validatePageFields(template, data).map((issue) =>
          issue.code === 'unrecognized_keys'
            ? `unused field(s) not part of "${data.template}": ${issue.keys.join(
                ', ',
              )} — remove them unless the content should be kept`
            : `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        )
      : [registry.errors[data.template] ?? `Unknown template "${data.template}"`]
    if (warnings.length === 0) return message
    return `${message}\n\nSchema warnings (slide still saved; surfaced in the editor):\n- ${warnings.join(
      '\n- ',
    )}`
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
   create_template/update_template transpile and evaluate the module in Node
   to check its exports; keep browser APIs inside components/effects. Use
   screenshot_slide to verify rendering in the browser.
   Tailwind CSS for custom templates is generated from their source (allow a
   beat before screenshotting a brand-new class).

Theme instructions from the deck's theme author:
${deckTheme.aiInstructions ?? 'none'}`,
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
        const message = await withDoc(
          resolveDeck(deck),
          async (d) => {
            const registry = await templateRegistry(d)
            ops.updateSlide(d, pageId, source)
            return withWarnings(`Updated slide ${pageId}.`, source, registry)
          },
          { write: true },
        )
        return text(message)
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
        const message = await withDoc(
          resolveDeck(deck),
          async (d) => {
            const registry = await templateRegistry(d)
            const created = ops.createSlide(d, source, { atIndex, filename })
            return withWarnings(
              `Created slide ${created.pageId} (${created.filename}).`,
              source,
              registry,
            )
          },
          { write: true },
        )
        return text(message)
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
        const registry = await withDoc(resolveDeck(deck), templateRegistry)
        const result = Object.fromEntries(
          Object.entries(registry.origins).map(([name, kind]) => {
            const mod = registry.templates[name]
            return [
              name,
              {
                kind,
                editable: kind === 'document',
                description: mod?.description,
                fields: describeSchema(mod?.Schema),
                example: mod?.example,
                error: registry.errors[name],
              },
            ]
          }),
        )
        return text(JSON.stringify(result, null, 2))
      }),
  )

  server.tool(
    'read_template',
    "Read the active template's TSX source (document > file > theme). Do this before creating a template based on an existing one.",
    { name: z.string().describe('Template name from list_templates'), deck: DECK_ARG },
    async ({ name, deck }) =>
      run(async () => {
        const source = await withDoc(resolveDeck(deck), async (d) => {
          // Raw source remains readable even when a document override is broken.
          const document = readTemplateSources(d)
          if (Object.hasOwn(document, name)) return document[name]
          return (await templateRegistry(d)).templates[name]?.source
        })
        if (source !== undefined) return text(source)
        return errorText(`No template named "${name}" — use list_templates`)
      }),
  )

  server.tool(
    'create_template',
    'Create a custom (doc-stored) template from TSX source. Export `Template` ({ data }) => JSX, preferably `Schema` (zod object), and optionally `description` (one-line when-to-use, shown in list_templates); imports limited to react, zod, @oxide/fable. The module is evaluated in Node to check its exports; verify browser rendering with screenshot_slide.',
    {
      name: z.string().describe('PascalCase template name (must be new)'),
      source: z.string().describe('Full TSX module source'),
      deck: DECK_ARG,
    },
    async ({ name, source, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        validateTemplateSource(source)
        await withDoc(deckId, (d) => ops.createDocTemplate(d, name, source), {
          write: true,
        })
        await syncTemplateScratch(deckId)
        return text(`Created template "${name}" — usable in slides via template: ${name}.`)
      }),
  )

  server.tool(
    'update_template',
    "Replace a custom (doc-stored) template's TSX source. Built-ins are read-only — copy them with create_template instead. Transpiled and evaluated in Node; verify rendering with screenshot_slide.",
    {
      name: z.string(),
      source: z.string().describe('Full TSX module source'),
      deck: DECK_ARG,
    },
    async ({ name, source, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        validateTemplateSource(source)
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
          `Theme: ${deckTheme.name}\n\nTheme author instructions:\n${
            deckTheme.aiInstructions ?? 'none'
          }\n\n${
            deckTheme.designDoc
              ? `Design document:\n\n${deckTheme.designDoc}`
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
    'upload_file',
    "Upload an image (or other asset) into the deck's room storage from a local file, a URL, or inline base64. Returns a fable:<fileId> ref to use as an image field value or inline as ![alt](fable:<fileId>). Files live with the deck — preferred over add_asset.",
    {
      path: z
        .string()
        .optional()
        .describe('Local file to upload (absolute, or relative to the deck directory)'),
      url: z.string().optional().describe('http(s) URL to fetch and upload'),
      base64: z
        .string()
        .optional()
        .describe('Inline file contents, base64-encoded (small files only)'),
      filename: z
        .string()
        .optional()
        .describe('Stored filename; defaults to the path/url basename'),
      mimeType: z
        .string()
        .optional()
        .describe('MIME type; inferred from the filename extension when omitted'),
      deck: DECK_ARG,
    },
    async ({ path: filePath, url, base64, filename, mimeType, deck }) =>
      run(async () => {
        const deckId = resolveDeck(deck)
        if ([filePath, url, base64].filter((s) => s !== undefined).length !== 1) {
          return errorText('Provide exactly one of path, url, or base64')
        }
        let buf: Buffer
        let fetchedType: string | undefined
        if (filePath !== undefined) {
          try {
            buf = await fs.readFile(path.resolve(userRoot, filePath))
          } catch (e) {
            return errorText(`Could not read ${filePath}: ${(e as Error).message}`)
          }
        } else if (url !== undefined) {
          if (!/^https?:\/\//.test(url)) return errorText('url must be http(s)')
          const res = await fetch(url).catch((e: Error) => e)
          if (res instanceof Error)
            return errorText(`Fetching ${url} failed: ${res.message}`)
          if (!res.ok) return errorText(`Fetching ${url} failed: ${res.status}`)
          buf = Buffer.from(await res.arrayBuffer())
          fetchedType = res.headers.get('content-type')?.split(';')[0].trim() || undefined
        } else {
          if (filename === undefined) return errorText('filename is required with base64')
          buf = Buffer.from(base64!, 'base64')
        }
        if (buf.byteLength === 0) return errorText('Empty file')
        if (buf.byteLength > 50 * 1024 * 1024) return errorText('File exceeds 50 MB')
        const name =
          path.basename(
            filename ?? filePath ?? decodeURIComponent(new URL(url!).pathname),
          ) || 'file'
        const type =
          mimeType ??
          {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            avif: 'image/avif',
            mp4: 'video/mp4',
          }[name.split('.').pop()?.toLowerCase() ?? ''] ??
          fetchedType ??
          'application/octet-stream'
        await ensureRoom(liveblocks, deckId)
        const info = await uploadRoomFile(liveblocks, deckId, buf, name, type)
        return text(
          `Uploaded ${info.name} (${info.size} bytes) — reference it as fable:${info.id}`,
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

  return {
    server,
    async dispose() {
      await stopHeartbeat()
      await browser?.close().catch(() => {})
      await server.close()
    },
  }
}

export async function startMcpServer(options: McpServerOptions) {
  const handle = await createMcpServer(options)
  await handle.server.connect(new StdioServerTransport())
  console.error(
    `[fable-mcp] serving decks on stdio${
      options.defaultDeck ? ` (default: "${options.defaultDeck}")` : ''
    }`,
  )
  return handle
}
