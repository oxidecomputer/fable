import autoprefixer from 'autoprefixer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme.js'
import tailwindPlugin from 'tailwindcss/plugin.js'
import type { Plugin, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteToml } from 'vite-plugin-toml'

export type FableOptions = {
  /** Path (relative to project root) of the TOML content file. Default: 'content.toml'. */
  content?: string
  /** Path (relative to project root) of the custom templates directory. Default: 'templates'. */
  templatesDir?: string
}

const ENTRY_ID = 'virtual:fable/entry'
const RESOLVED_ENTRY = '\0' + ENTRY_ID

const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..')

function normalize(p: string) {
  return p.replace(/^\.?\/+/, '').replace(/\/+$/, '')
}

export default function fable(options: FableOptions = {}): PluginOption {
  const contentPath = normalize(options.content ?? 'content.toml')
  const templatesDir = normalize(options.templatesDir ?? 'templates')

  const fablePlugin: Plugin = {
    name: 'fable',
    enforce: 'pre',

    config() {
      return {
        optimizeDeps: {
          include: ['mousetrap', 'highlight.js', 'react', 'react-dom/client'],
        },
        server: {
          fs: { allow: [packageRoot] },
        },
        css: {
          postcss: {
            plugins: [
              tailwindcss({
                content: [
                  path.join(packageRoot, 'src/**/*.{ts,tsx}'),
                  `./${templatesDir}/**/*.{jsx,tsx}`,
                  `./${contentPath}`,
                  './index.html',
                ],
                theme: {
                  extend: {
                    fontFamily: {
                      sans: ['Inter', ...defaultTheme.fontFamily.sans],
                    },
                  },
                },
                plugins: [
                  tailwindPlugin(({ addVariant }) => {
                    addVariant('children', '& > *')
                  }),
                ],
              }),
              autoprefixer(),
            ],
          },
        },
      }
    },

    resolveId(id) {
      if (id === ENTRY_ID) return RESOLVED_ENTRY
    },

    load(id) {
      if (id !== RESOLVED_ENTRY) return

      return `
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@oxide/fable'
import '@oxide/fable/styles'
import content from '/${contentPath}'

const userTemplates = import.meta.glob('/${templatesDir}/*.{jsx,tsx}', { eager: true })
const customTemplates = {}
for (const [filePath, mod] of Object.entries(userTemplates)) {
  const name = filePath.split('/').pop().replace(/\\.(jsx|tsx)$/, '')
  customTemplates[name] = mod
}

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    createElement(
      StrictMode,
      null,
      createElement(App, { content, customTemplates }),
    ),
  )
}
`
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@id/${ENTRY_ID}` },
          injectTo: 'body',
        },
      ]
    },
  }

  return [react(), ViteToml(), fablePlugin]
}
