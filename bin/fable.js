#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..')
const runtimeRoot = path.join(packageRoot, 'runtime')
const configFile = path.join(runtimeRoot, 'vite.config.ts')

const HELP = `Usage: fable <command>

Commands:
  dev     Start the dev server in the current directory
  build   Build a production deck into ./dist
  help    Show this message
`

const cmd = process.argv[2]
const userRoot = process.cwd()
process.env.FABLE_USER_ROOT = userRoot

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

async function main() {
  switch (cmd) {
    case 'dev':
    case undefined:
      return dev()
    case 'build':
      return build()
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
