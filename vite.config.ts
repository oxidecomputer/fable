import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { ViteToml } from 'vite-plugin-toml'

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    plugins: [react(), ViteToml()],
    optimizeDeps: {
      include: ['mousetrap', 'react-dom/client', 'highlight.js', 'react'],
    },
    build: {
      commonjsOptions: {
        include: [/mousetrap/, /highlight.js/, /node_modules/],
      },
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['../../'],
      },
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src/templates'),
      },
    },
  })
}
