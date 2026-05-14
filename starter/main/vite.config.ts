import { defineConfig } from 'vite'
import fable from '@oxide/fable/plugin'

export default defineConfig({
  plugins: [fable()],
})
