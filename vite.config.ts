import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ViteToml } from 'vite-plugin-toml'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ViteToml()],
  optimizeDeps: {
    include: ['mousetrap', 'react-dom/client', 'highlight.js', 'react'],
  },
  build: {
    commonjsOptions: {
      include: [/mousetrap/, /react-dom/, /react/, /highlight.js/, /node_modules/],
    },
  },
})
