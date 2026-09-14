#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..')
const runtimeRoot = path.join(packageRoot, 'runtime')
const configFile = path.join(runtimeRoot, 'vite.config.ts')

const HELP = `Usage: fable <command> [--dir <deck-dir>]

Commands:
  dev     Start the dev server in the current directory
  build   Build a production deck into ./dist
  push    Seed the deck's Liveblocks room from content/ (--force to overwrite,
          --room <id> to override deck.yml's room)
  pull    Export the deck's Liveblocks room back into content/
  mcp     Run an MCP server (stdio) exposing the deck's room to local agents
          such as Claude Code — register with: claude mcp add fable -- npx fable mcp
          Screenshots render via a local dev server by default; point them at a
          deployed deck with --render-url <url> (or FABLE_RENDER_URL)
  help    Show this message

--dir runs a command against a deck directory other than the cwd (useful for
\`fable mcp\` when the MCP client is launched from elsewhere).
push/pull/mcp require LIVEBLOCKS_SECRET_KEY (env or the deck's .env) and a
room (deck.yml \`room:\` or --room).
`

const cmd = process.argv[2]
const args = process.argv.slice(3)

function argValue(flag) {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

// --dir points every command at a deck directory other than the cwd; chdir
// before anything reads .env, deck.yml, or resolves output paths.
const dirArg = argValue('--dir')
if (dirArg) {
  try {
    process.chdir(path.resolve(dirArg))
  } catch {
    console.error(`--dir: no such directory: ${dirArg}`)
    process.exit(1)
  }
}
const userRoot = process.cwd()
process.env.FABLE_USER_ROOT = userRoot

/**
 * Load .env files from the deck directory (`.env`, `.env.local`,
 * `.env.[mode]`, `.env.[mode].local`) into process.env before anything reads
 * LIVEBLOCKS_SECRET_KEY / VITE_FABLE_API_URL / etc. Real environment
 * variables win over .env values.
 */
async function loadDotenv() {
  const { loadEnv } = await import('vite')
  const mode = cmd === 'build' ? 'production' : 'development'
  const fileEnv = loadEnv(mode, userRoot, '')
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function baseConfig() {
  return {
    configFile,
    root: runtimeRoot,
    publicDir: path.join(userRoot, 'public'),
    build: {
      outDir: path.join(userRoot, 'dist'),
      emptyOutDir: true,
    },
  }
}

async function dev() {
  const { createServer } = await import('vite')
  const server = await createServer(baseConfig())
  await server.listen()
  server.printUrls()
}

async function build() {
  const { build } = await import('vite')
  await build(baseConfig())
}

/**
 * The collab helpers live in the package's TypeScript source, so load them
 * through a throwaway Vite server in middleware mode (same transform
 * pipeline the CLI already relies on).
 */
async function withNodeModules(fn) {
  const { createServer } = await import('vite')
  const server = await createServer({
    configFile: false,
    root: runtimeRoot,
    logLevel: 'error',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const deckFiles = await server.ssrLoadModule(
      path.join(packageRoot, 'src', 'node', 'deck-files.ts'),
    )
    const collab = await server.ssrLoadModule(
      path.join(packageRoot, 'src', 'node', 'collab.ts'),
    )
    return await fn(deckFiles, collab)
  } finally {
    await server.close()
  }
}

function requireSecret() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secret) {
    console.error(
      `LIVEBLOCKS_SECRET_KEY is not set — put it in ${userRoot}/.env or the environment.` +
        (dirArg ? '' : ' If the deck lives elsewhere, pass --dir <deck-dir>.'),
    )
    process.exit(1)
  }
  return secret
}

async function push() {
  const secret = requireSecret()
  const force = args.includes('--force')
  await withNodeModules(async (deckFiles, collab) => {
    const { content, filenames, room: deckRoom } = await deckFiles.loadDeck(userRoot)
    const room = argValue('--room') ?? deckRoom
    if (!room) {
      console.error(
        'No room configured — add `room: <id>` to content/deck.yml or pass --room',
      )
      process.exit(1)
    }
    const liveblocks = collab.createLiveblocks(secret)
    try {
      await collab.seedRoom(liveblocks, room, content, filenames, { force })
    } catch (err) {
      if (err?.name === 'RoomNotEmptyError') {
        console.error(`${err.message}\nRe-run with --force to replace the room's deck.`)
        process.exit(1)
      }
      throw err
    }
    console.log(`Pushed ${filenames.length} page(s) to room "${room}"`)
  })
}

async function pull() {
  const secret = requireSecret()
  await withNodeModules(async (deckFiles, collab) => {
    let deckRoom
    try {
      deckRoom = (await deckFiles.loadDeck(userRoot)).room
    } catch {
      /* content/ may not exist yet — --room still works */
    }
    const room = argValue('--room') ?? deckRoom
    if (!room) {
      console.error(
        'No room configured — add `room: <id>` to content/deck.yml or pass --room',
      )
      process.exit(1)
    }
    const liveblocks = collab.createLiveblocks(secret)
    const { meta, filenames, sources, parseErrors } = await collab.exportRoomSources(
      liveblocks,
      room,
    )
    await deckFiles.writeDeckFiles(userRoot, { meta, filenames, sources, room })
    for (const [file, err] of Object.entries(parseErrors)) {
      console.warn(`warning: ${file} does not parse (exported verbatim): ${err}`)
    }

    // Remove pages that no longer exist in the room.
    const contentDir = path.join(userRoot, 'content')
    const keep = new Set(filenames)
    const existing = (await fs.readdir(contentDir)).filter((f) => f.endsWith('.md'))
    for (const file of existing) {
      if (!keep.has(file)) await fs.unlink(path.join(contentDir, file)).catch(() => {})
    }
    console.log(`Pulled ${filenames.length} page(s) from room "${room}" into content/`)
  })
}

async function mcp() {
  const secret = requireSecret()
  // The Vite server stays alive for the whole MCP session as the TS module
  // runner. By default it also listens and serves the deck app so the
  // screenshot tool has something rendering the live room; with
  // --render-url / FABLE_RENDER_URL (e.g. the deployed deck, which is
  // connected to the same room) it stays in middleware mode and screenshots
  // target the deployment instead. stdout must stay clean for the protocol.
  const renderUrl = argValue('--render-url') ?? process.env.FABLE_RENDER_URL
  const { createServer } = await import('vite')
  const vite = await createServer({
    ...baseConfig(),
    logLevel: 'silent',
    server: renderUrl ? { middlewareMode: true } : { host: '127.0.0.1' },
  })
  let baseUrl
  if (renderUrl) {
    baseUrl = renderUrl.replace(/\/$/, '')
  } else {
    await vite.listen()
    baseUrl = vite.resolvedUrls?.local[0]?.replace(/\/$/, '')
  }
  const deckFiles = await vite.ssrLoadModule(
    path.join(packageRoot, 'src', 'node', 'deck-files.ts'),
  )
  let deckRoom
  try {
    deckRoom = (await deckFiles.loadDeck(userRoot)).room
  } catch {
    /* --room still works without content/ */
  }
  // A default deck is optional — tools take a `deck` argument per call.
  const defaultDeck = argValue('--room') ?? deckRoom
  const { startMcpServer } = await vite.ssrLoadModule(
    path.join(packageRoot, 'src', 'node', 'mcp.ts'),
  )
  const { loadTheme, loadFileTemplates } = await vite.ssrLoadModule(
    path.join(packageRoot, 'src', 'node', 'templates.ts'),
  )
  const loadModule = (filename) => vite.ssrLoadModule(filename)
  const theme = await loadTheme(process.env.FABLE_THEME ?? 'oxcon26', loadModule)
  // Tailwind doesn't notice new scratch files on its own — the MCP server
  // calls this after template changes so screenshots render with fresh CSS.
  const reloadCss = async () => {
    const cssPath = path.join(packageRoot, 'styles', 'src', 'index.css')
    const mods = vite.moduleGraph.getModulesByFile(cssPath)
    if (mods) for (const m of mods) await vite.reloadModule(m).catch(() => {})
  }
  const mcpServer = await startMcpServer({
    secret,
    defaultDeck,
    userRoot,
    baseUrl,
    reloadCss,
    theme,
    loadFileTemplates: () => loadFileTemplates(userRoot, loadModule),
  })
  // Exit when the MCP client disconnects.
  process.stdin.on('close', async () => {
    await mcpServer.dispose().catch(() => {})
    await vite.close().catch(() => {})
    process.exit(0)
  })
}

async function main() {
  await loadDotenv()
  switch (cmd) {
    case 'dev':
    case undefined:
      return dev()
    case 'build':
      return build()
    case 'push':
      return push()
    case 'pull':
      return pull()
    case 'mcp':
      return mcp()
    case 'help':
    case '-h':
    case '--help':
      process.stdout.write(HELP)
      return
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
