import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin, PluginOption, ViteDevServer } from 'vite'
import YAML from 'yaml'

export type FableOptions = {
  /** Path (relative to project root) of the custom templates directory. Default: 'templates'. */
  templatesDir?: string
  /** Path (relative to project root) of the content directory. Default: 'content'. */
  contentDir?: string
}

type PageData = Record<string, any> & { template: string }
type Content = {
  title?: string
  config?: { page_numbers?: boolean }
  pages: PageData[]
}

const LONG_FORM_FIELDS = new Set([
  'text',
  'body',
  'diagram',
  'description',
  'content',
  'notes',
])

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const DIRECTIVE_OPEN_RE = /^:::\s+(\S+)\s*$/
const DIRECTIVE_CLOSE_RE = /^:::\s*$/

const ENTRY_ID = 'virtual:fable/entry'
const RESOLVED_ENTRY = '\0' + ENTRY_ID

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..')

function normalize(p: string) {
  return p.replace(/^\.?\/+/, '').replace(/\/+$/, '')
}

function parsePage(text: string): PageData {
  const m = text.match(FRONTMATTER_RE)
  if (!m) throw new Error('Page is missing YAML frontmatter (--- ... ---)')
  const frontmatter = YAML.parse(m[1]) ?? {}
  const body = m[2].replace(/^\r?\n+/, '').replace(/\r?\n+$/, '')

  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('Frontmatter must be a YAML object')
  }

  const lines = body.split(/\r?\n/)
  const hasDirectives = lines.some((l) => DIRECTIVE_OPEN_RE.test(l))
  const bodyFields: Record<string, string> = {}

  if (hasDirectives) {
    let currentName: string | null = null
    let buf: string[] = []
    for (const line of lines) {
      const open = line.match(DIRECTIVE_OPEN_RE)
      if (open && currentName === null) {
        currentName = open[1]
        buf = []
        continue
      }
      if (DIRECTIVE_CLOSE_RE.test(line) && currentName !== null) {
        bodyFields[currentName] = buf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
        currentName = null
        buf = []
        continue
      }
      if (currentName !== null) buf.push(line)
    }
    if (currentName !== null) {
      throw new Error(`Unclosed ::: ${currentName} block`)
    }
  } else if (body.length > 0) {
    bodyFields.text = body
  }

  return { ...frontmatter, ...bodyFields }
}

function serializePage(data: PageData): string {
  const { template, custom_template, ...rest } = data
  const longFormKeys = Object.keys(rest).filter(
    (k) => LONG_FORM_FIELDS.has(k) && typeof rest[k] === 'string',
  )

  const useSingleBody = longFormKeys.length === 1 && longFormKeys[0] === 'text'

  const frontmatter: Record<string, any> = { template }
  if (custom_template !== undefined) frontmatter.custom_template = custom_template
  for (const [k, v] of Object.entries(rest)) {
    if (useSingleBody && k === 'text') continue
    if (!useSingleBody && longFormKeys.includes(k)) continue
    frontmatter[k] = v
  }

  const yamlText = YAML.stringify(frontmatter, { lineWidth: 0 }).replace(/\n$/, '')
  let body = ''
  if (useSingleBody) {
    body = String(rest.text ?? '')
  } else if (longFormKeys.length > 0) {
    body = longFormKeys.map((k) => `::: ${k}\n${String(rest[k] ?? '')}\n:::`).join('\n\n')
  }

  return `---\n${yamlText}\n---\n${body ? `\n${body}\n` : ''}`
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)
}

async function loadDeck(
  rootDir: string,
): Promise<{ content: Content; filenames: string[]; files: string[] }> {
  const deckYmlPath = path.join(rootDir, 'content', 'deck.yml')
  const deckYml = await fs.readFile(deckYmlPath, 'utf8')
  const deck = YAML.parse(deckYml) ?? {}

  const filenames: string[] = Array.isArray(deck.pages) ? deck.pages : []
  const files: string[] = [deckYmlPath]
  const pages: PageData[] = []

  for (const fname of filenames) {
    const filePath = path.join(rootDir, 'content', fname)
    files.push(filePath)
    const text = await fs.readFile(filePath, 'utf8')
    try {
      pages.push(parsePage(text))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to parse ${fname}: ${msg}`)
    }
  }

  const content: Content = { pages }
  if (typeof deck.title === 'string') content.title = deck.title
  if (deck.config) content.config = deck.config
  return { content, filenames, files }
}

async function serializeDeck(
  rootDir: string,
  content: Content,
  filenames: string[],
): Promise<void> {
  if (filenames.length !== content.pages.length) {
    throw new Error(
      `Filename count (${filenames.length}) does not match page count (${content.pages.length})`,
    )
  }
  const contentDir = path.join(rootDir, 'content')
  await fs.mkdir(contentDir, { recursive: true })
  for (let i = 0; i < content.pages.length; i++) {
    const filePath = path.join(contentDir, filenames[i])
    await writeAtomic(filePath, serializePage(content.pages[i]))
  }
  const deckPayload: Record<string, any> = {}
  if (content.title) deckPayload.title = content.title
  if (content.config) deckPayload.config = content.config
  deckPayload.pages = filenames
  await writeAtomic(
    path.join(contentDir, 'deck.yml'),
    YAML.stringify(deckPayload, { lineWidth: 0 }),
  )
}

async function readReqBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: any, status: number, body: any) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function attachContentMiddleware(
  server: ViteDevServer,
  rootDir: string,
  ignore: { ignoreUntil: number },
) {
  server.middlewares.use('/_fable/content', async (req, res, next) => {
    try {
      if (req.method === 'GET') {
        const { content, filenames } = await loadDeck(rootDir)
        sendJson(res, 200, { content, filenames })
        return
      }

      if (req.method === 'PUT') {
        const body = await readReqBody(req)
        let payload: { content: Content; filenames: string[] }
        try {
          payload = JSON.parse(body)
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON' })
          return
        }
        if (
          !payload ||
          !Array.isArray(payload.filenames) ||
          !payload.content ||
          !Array.isArray(payload.content.pages)
        ) {
          sendJson(res, 400, { error: 'Expected { content, filenames }' })
          return
        }
        if (payload.filenames.length !== payload.content.pages.length) {
          sendJson(res, 400, { error: 'filenames and pages length mismatch' })
          return
        }

        const contentDir = path.join(rootDir, 'content')
        let existing: string[] = []
        try {
          existing = (await fs.readdir(contentDir)).filter((f) => f.endsWith('.md'))
        } catch {
          /* dir may not yet exist */
        }

        ignore.ignoreUntil = Date.now() + 1500
        await serializeDeck(rootDir, payload.content, payload.filenames)

        const keep = new Set(payload.filenames)
        for (const file of existing) {
          if (!keep.has(file)) {
            await fs.unlink(path.join(contentDir, file)).catch(() => {})
          }
        }

        sendJson(res, 200, { ok: true })
        return
      }

      next()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: msg })
    }
  })
}

export default function fable(options: FableOptions = {}): PluginOption {
  const templatesDir = normalize(options.templatesDir ?? 'templates')
  const contentDir = normalize(options.contentDir ?? 'content')

  let projectRoot = process.cwd()
  const ignore = { ignoreUntil: 0 }

  const fablePlugin: Plugin = {
    name: 'fable',
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root
    },

    config() {
      return {
        optimizeDeps: {
          include: ['mousetrap', 'highlight.js', 'react', 'react-dom/client'],
        },
        server: {
          fs: { allow: [packageRoot] },
        },
      }
    },

    configureServer(server) {
      attachContentMiddleware(server, projectRoot, ignore)
    },

    hotUpdate({ file, server }) {
      const contentPath = path.join(projectRoot, contentDir)
      if (!file.startsWith(contentPath)) return

      // Returning [] from hotUpdate skips vite's default module-graph
      // invalidation, so invalidate the virtual entry explicitly. Without
      // this, a refresh after our own PUT would serve the stale module and
      // overwrite the new state with the old.
      const entry = server.moduleGraph.getModuleById(RESOLVED_ENTRY)
      if (entry) server.moduleGraph.invalidateModule(entry)

      if (Date.now() < ignore.ignoreUntil) return []

      server.ws.send({ type: 'full-reload' })
      return []
    },

    resolveId(id) {
      if (id === ENTRY_ID) return RESOLVED_ENTRY
    },

    async load(id) {
      if (id !== RESOLVED_ENTRY) return

      const { content, filenames, files } = await loadDeck(projectRoot)
      for (const f of files) this.addWatchFile(f)

      const initial = JSON.stringify({ content, filenames })

      return `
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@oxide/fable'
import '@oxide/fable/styles'

const { content, filenames } = ${initial}

const userTemplates = import.meta.glob('/${templatesDir}/*.{jsx,tsx}', { eager: true })
const customTemplates = {}
for (const [filePath, mod] of Object.entries(userTemplates)) {
  const name = filePath.split('/').pop().replace(/\\.(jsx|tsx)$/, '')
  customTemplates[name] = mod
}

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    createElement(
      StrictMode,
      null,
      createElement(App, { content, filenames, customTemplates }),
    ),
  )
}
`
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@id/${ENTRY_ID}` },
          injectTo: 'body',
        },
      ]
    },
  }

  return [react(), tailwindcss(), fablePlugin]
}
