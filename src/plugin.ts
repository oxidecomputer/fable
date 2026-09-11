import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin, PluginOption, ViteDevServer } from 'vite'

import {
  RoomNotEmptyError,
  authorizeUser,
  createLiveblocks,
  ensureRoom,
  fetchDocTemplateSources,
  listDecks,
  seedRoom,
} from './node/collab'
import { loadDeck } from './node/deck-files'
import { docTemplateScratchDir, syncDocTemplateScratch } from './node/doc-template-scan'

export type FableOptions = {
  /** Path (relative to project root) of the custom templates directory. Default: 'templates'. */
  templatesDir?: string
  /**
   * Directory containing the consumer's `content/` and `templates/`. Defaults to
   * Vite's `root`. Set this when Vite's root is inside the package (CLI mode)
   * but the deck data lives elsewhere.
   */
  userRoot?: string
}

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

/**
 * Local-dev Liveblocks auth: mounted only when LIVEBLOCKS_SECRET_KEY is set.
 * Identity is the local OS user — real identity is a hosted-server concern.
 */
function attachLiveblocksMiddleware(server: ViteDevServer, secret: string) {
  server.middlewares.use('/_fable/liveblocks-auth', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'POST only' })
      return
    }
    try {
      const body = await readReqBody(req)
      let payload: { room?: string } = {}
      try {
        payload = JSON.parse(body)
      } catch {
        /* liveblocks client always sends JSON, but be lenient */
      }
      if (!payload.room) {
        sendJson(res, 400, { error: 'Expected { room }' })
        return
      }
      const liveblocks = createLiveblocks(secret)
      await ensureRoom(liveblocks, payload.room)
      const userId = process.env.FABLE_USER ?? os.userInfo().username
      const { status, body: authBody } = await authorizeUser(liveblocks, payload.room, {
        id: userId,
      })
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(authBody)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { error: msg })
    }
  })
}

/**
 * Clients mirror the room's doc-stored template sources here whenever they
 * change, keeping the Tailwind scratch dir (an @source) in sync live.
 */
function attachDocTemplateMiddleware(server: ViteDevServer, userRoot: string) {
  server.middlewares.use('/_fable/doc-templates', async (req, res) => {
    if (req.method !== 'PUT') {
      sendJson(res, 405, { error: 'PUT only' })
      return
    }
    try {
      const payload = JSON.parse(await readReqBody(req))
      if (
        !payload ||
        typeof payload.deck !== 'string' ||
        typeof payload.templates !== 'object'
      ) {
        sendJson(res, 400, { error: 'Expected { deck, templates }' })
        return
      }
      await syncDocTemplateScratch(userRoot, payload.deck, payload.templates)
      await reloadPackageCss(server)
      sendJson(res, 200, { ok: true })
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
    }
  })
}

/** Deck index data: rooms with titles/sizes, for the app's landing page. */
function attachDecksMiddleware(server: ViteDevServer, secret: string) {
  server.middlewares.use('/_fable/decks', async (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'GET only' })
      return
    }
    try {
      sendJson(res, 200, { decks: await listDecks(createLiveblocks(secret)) })
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
    }
  })
}

/**
 * Tailwind only rescans @source globs when the CSS module regenerates, and
 * it doesn't watch for new files in the scratch dir — reload the stylesheet
 * module explicitly so fresh template classes hot-apply in open tabs.
 */
export async function reloadPackageCss(server: ViteDevServer): Promise<void> {
  const mods = server.moduleGraph.getModulesByFile(PACKAGE_STYLES)
  if (!mods) return
  for (const mod of mods) {
    await server.reloadModule(mod).catch(() => {})
  }
}

/** Seed an empty room from content/ so `fable dev` works out of the box. */
async function autoSeed(
  server: ViteDevServer,
  userRoot: string,
  secret: string,
  roomId: string,
) {
  const logger = server.config.logger
  try {
    const { content, filenames } = await loadDeck(userRoot)
    const liveblocks = createLiveblocks(secret)
    await seedRoom(liveblocks, roomId, content, filenames)
    logger.info(`[fable] seeded room "${roomId}" with ${filenames.length} page(s)`)
  } catch (err) {
    if (err instanceof RoomNotEmptyError) return // already has a deck — leave it
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[fable] could not seed room "${roomId}": ${msg}`)
  }
}

export default function fable(options: FableOptions = {}): PluginOption {
  const templatesDir = normalize(options.templatesDir ?? 'templates')

  let userRoot = options.userRoot ?? process.cwd()
  let isDev = false

  const fablePlugin: Plugin = {
    name: 'fable',
    enforce: 'pre',

    configResolved(config) {
      if (!options.userRoot) userRoot = config.root
      isDev = config.command === 'serve'
    },

    async buildStart() {
      // Builds scan the scratch dir too — populate it from the room when a
      // secret is available so doc-template classes make it into built CSS.
      const secret = process.env.LIVEBLOCKS_SECRET_KEY
      if (isDev || !secret) return
      try {
        const { room } = await loadDeck(userRoot)
        if (!room) return
        await syncDocTemplateScratch(
          userRoot,
          room,
          await fetchDocTemplateSources(createLiveblocks(secret), room),
        )
      } catch {
        /* build proceeds without doc-template classes */
      }
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
      const secret = process.env.LIVEBLOCKS_SECRET_KEY
      if (secret) {
        attachLiveblocksMiddleware(server, secret)
        attachDocTemplateMiddleware(server, userRoot)
        attachDecksMiddleware(server, secret)
        loadDeck(userRoot)
          .then(async ({ room }) => {
            if (room) {
              // Seed the Tailwind scratch dir from the room's current
              // doc-stored templates before the first CSS build settles.
              await syncDocTemplateScratch(
                userRoot,
                room,
                await fetchDocTemplateSources(createLiveblocks(secret), room).catch(
                  () => ({}),
                ),
              ).catch(() => {})
              return autoSeed(server, userRoot, secret, room)
            }
          })
          .catch(() => {
            /* no content/ — decks are created from the index */
          })
      } else {
        server.config.logger.warn(
          '[fable] LIVEBLOCKS_SECRET_KEY is not set — editing is disabled (present mode only)',
        )
      }

      // When Vite's root is inside the package (CLI mode), the watcher
      // doesn't follow templates/ on its own. Add it.
      const templatesPath = path.join(userRoot, templatesDir)
      server.watcher.add([templatesPath])

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

    hotUpdate({ file }) {
      // The scratch mirrors of doc-stored templates are Tailwind scan
      // sources, not modules — Vite's fallback for changed non-module files
      // is a full page reload, which would reload the editor on every
      // template keystroke. CSS regeneration is driven explicitly
      // (reloadPackageCss), so suppress these entirely.
      if (file.startsWith(docTemplateScratchDir(userRoot))) return []
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
        // Doc-stored templates are mirrored into a scratch dir (see
        // node/doc-template-scan.ts) so their utility classes exist too.
        const scratchPath = docTemplateScratchDir(userRoot)
        return [
          code,
          `@source ${JSON.stringify(templatesPath)};`,
          `@source ${JSON.stringify(scratchPath)};`,
          '',
        ].join('\n')
      }
    },

    async load(id) {
      if (id !== RESOLVED_ENTRY) return

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
          // The raw source rides along so the editor can fork a file template
          // into a doc-stored custom template.
          return [
            `import * as t_${i} from ${JSON.stringify(abs)}`,
            `import t_${i}_source from ${JSON.stringify(abs + '?raw')}`,
          ].join('\n')
        })
        .join('\n')

      const templateEntries = templateFiles
        .map((file, i) => {
          const name = file.replace(/\.(jsx|tsx)$/, '')
          return `  ${JSON.stringify(name)}: { ...t_${i}, source: t_${i}_source },`
        })
        .join('\n')

      // The directory is the theme; decks live in rooms, picked by URL.
      // Collab is available whenever an auth endpoint is: dev middleware when
      // LIVEBLOCKS_SECRET_KEY is set, the hosted server (VITE_FABLE_API_URL)
      // for builds.
      let collab: {
        authEndpoint: string
        decksEndpoint: string
        apiToken?: string
      } | null = null
      const apiUrl = process.env.VITE_FABLE_API_URL
      if (isDev && process.env.LIVEBLOCKS_SECRET_KEY) {
        collab = {
          authEndpoint: '/_fable/liveblocks-auth',
          decksEndpoint: '/_fable/decks',
        }
      } else if (apiUrl) {
        const apiBase = apiUrl.replace(/\/$/, '')
        collab = {
          authEndpoint: `${apiBase}/api/liveblocks-auth`,
          decksEndpoint: `${apiBase}/api/decks`,
        }
        if (process.env.VITE_FABLE_API_TOKEN) {
          collab.apiToken = process.env.VITE_FABLE_API_TOKEN
        }
      }

      const initial = JSON.stringify({ collab })

      return `
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from ${JSON.stringify(PACKAGE_APP_ENTRY)}
import ${JSON.stringify(PACKAGE_STYLES)}
${templateImports}

const { collab } = ${initial}

const customTemplates = {
${templateEntries}
}

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    createElement(
      StrictMode,
      null,
      createElement(App, { customTemplates, collab: collab ?? undefined }),
    ),
  )
}
`
    },
  }

  // fablePlugin must precede tailwindcss so its CSS transform (appending
  // @source directives) runs before Tailwind consumes the stylesheet.
  return [react(), fablePlugin, tailwindcss()]
}
