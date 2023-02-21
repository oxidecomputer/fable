import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ViteToml } from 'vite-plugin-toml'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ViteToml()],
})
