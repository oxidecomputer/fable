import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin, PluginOption, ViteDevServer } from 'vite'
import YAML from 'yaml'

export type FableOptions = {
  /** Path (relative to project root) of the custom templates directory. Default: 'templates'. */
  templatesDir?: string
  /** Path (relative to project root) of the content directory. Default: 'content'. */
  contentDir?: string
  /**
   * Directory containing the consumer's `content/` and `templates/`. Defaults to
   * Vite's `root`. Set this when Vite's root is inside the package (CLI mode)
   * but the deck data lives elsewhere.
   */
  userRoot?: string
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
const PACKAGE_APP_ENTRY = path.join(packageRoot, 'src', 'index.ts')
const PACKAGE_PLUGIN_ENTRY = path.join(packageRoot, 'src', 'plugin.ts')
const PACKAGE_STYLES = path.join(packageRoot, 'styles', 'src', 'index.css')
const requireFromPackage = createRequire(path.join(packageRoot, 'package.json'))

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

  let userRoot = options.userRoot ?? process.cwd()
  const ignore = { ignoreUntil: 0 }

  const fablePlugin: Plugin = {
    name: 'fable',
    enforce: 'pre',

    configResolved(config) {
      if (!options.userRoot) userRoot = config.root
    },

    config() {
      return {
        optimizeDeps: {
          include: ['mousetrap', 'highlight.js', 'react', 'react-dom/client'],
        },
        server: {
          fs: { allow: [packageRoot, userRoot] },
        },
      }
    },

    configureServer(server) {
      attachContentMiddleware(server, userRoot, ignore)

      // When Vite's root is inside the package (CLI mode), the watcher
      // doesn't follow content/ and templates/ on its own. Add them.
      const contentPath = path.join(userRoot, contentDir)
      const templatesPath = path.join(userRoot, templatesDir)
      server.watcher.add([contentPath, templatesPath])

      const onTemplateChange = (file: string) => {
        if (!file.startsWith(templatesPath)) return
        if (!/\.(jsx|tsx)$/.test(file)) return
        const entry = server.moduleGraph.getModuleById(RESOLVED_ENTRY)
        if (entry) server.moduleGraph.invalidateModule(entry)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onTemplateChange)
      server.watcher.on('unlink', onTemplateChange)
    },

    hotUpdate({ file, server }) {
      const contentPath = path.join(userRoot, contentDir)
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

    async resolveId(id, importer) {
      if (id === ENTRY_ID) return RESOLVED_ENTRY

      // Map `@oxide/fable` and subpaths to package source so consumer-side
      // templates can `import { Markdown } from '@oxide/fable'` even when
      // there's no @oxide/fable in their node_modules (CLI mode).
      if (id === '@oxide/fable') return PACKAGE_APP_ENTRY
      if (id === '@oxide/fable/styles') return PACKAGE_STYLES
      if (id === '@oxide/fable/plugin') return PACKAGE_PLUGIN_ENTRY

      // Bare specifiers from user files (templates) fall back to the
      // package's own node_modules in CLI mode where userRoot has none.
      if (!importer || importer === RESOLVED_ENTRY) return
      if (id.startsWith('.') || id.startsWith('\0') || path.isAbsolute(id)) return
      const resolved = await this.resolve(id, importer, { skipSelf: true })
      if (resolved) return resolved
      try {
        return requireFromPackage.resolve(id)
      } catch {
        return undefined
      }
    },

    transform(code, id) {
      // Append a Tailwind @source pointing at the user's templates to the
      // package's own index.css. Needed when Vite's root is inside the
      // package (CLI mode), since templates live outside Vite's root and so
      // Tailwind's auto-discovery misses them. Doing it here (rather than
      // via a virtual CSS module) ensures @tailwindcss/vite actually
      // processes the directive.
      if (id === PACKAGE_STYLES || id.startsWith(PACKAGE_STYLES + '?')) {
        const templatesPath = path.join(userRoot, templatesDir)
        return `${code}\n@source ${JSON.stringify(`${templatesPath}/**/*.{jsx,tsx}`)};\n`
      }
    },

    async load(id) {
      if (id !== RESOLVED_ENTRY) return

      const { content, filenames, files } = await loadDeck(userRoot)
      for (const f of files) this.addWatchFile(f)

      const templatesPath = path.join(userRoot, templatesDir)
      let templateFiles: string[] = []
      try {
        templateFiles = (await fs.readdir(templatesPath)).filter((f) =>
          /\.(jsx|tsx)$/.test(f),
        )
      } catch {
        /* templates dir is optional */
      }

      const templateImports = templateFiles
        .map((file, i) => {
          const abs = path.join(templatesPath, file)
          return `import * as t_${i} from ${JSON.stringify(abs)}`
        })
        .join('\n')

      const templateEntries = templateFiles
        .map((file, i) => {
          const name = file.replace(/\.(jsx|tsx)$/, '')
          return `  ${JSON.stringify(name)}: t_${i},`
        })
        .join('\n')

      const initial = JSON.stringify({ content, filenames })

      return `
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from ${JSON.stringify(PACKAGE_APP_ENTRY)}
import ${JSON.stringify(PACKAGE_STYLES)}
${templateImports}

const { content, filenames } = ${initial}

const customTemplates = {
${templateEntries}
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
  }

  return [react(), tailwindcss(), fablePlugin]
}
