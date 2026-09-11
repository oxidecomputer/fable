import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { createFableServer } from './app'

// Load ./.env if present (Node 20.12+); real env vars win.
try {
  ;(process as any).loadEnvFile?.()
} catch {
  /* no .env file */
}

const liveblocksSecretKey = process.env.LIVEBLOCKS_SECRET_KEY
const authToken = process.env.FABLE_AUTH_TOKEN
const port = Number(process.env.PORT ?? 8787)

if (!liveblocksSecretKey) {
  console.error('LIVEBLOCKS_SECRET_KEY is not set')
  process.exit(1)
}
if (!authToken) {
  console.error('FABLE_AUTH_TOKEN is not set')
  process.exit(1)
}

const app = new Hono()
app.use(
  '*',
  cors({ origin: (origin) => origin, allowHeaders: ['authorization', 'content-type'] }),
)
app.route('/', createFableServer({ liveblocksSecretKey, authToken }))

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`fable-server listening on :${info.port}`)
})
