import { defineConfig } from 'vite'

import fable from '../src/plugin'

const userRoot = process.env.FABLE_USER_ROOT
if (!userRoot) {
  throw new Error('FABLE_USER_ROOT env var must be set by the Fable CLI')
}

export default defineConfig({
  plugins: [fable({ userRoot })],
})
