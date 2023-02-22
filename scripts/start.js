import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'vite'

const __dirname = fileURLToPath(new URL('../', import.meta.url))

const run = async (root) => {
  const server = await createServer({
    root: root,
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    server: {
      port: 1337,
    },
  })
  await server.listen()

  server.printUrls()
}

export default run
