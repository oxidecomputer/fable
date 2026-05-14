import path from 'node:path'
import puppeteer from 'puppeteer'
import { preview } from 'vite'

/**
 * Build the deck first (e.g. `vite build`), then call exportPdf(dir).
 * Spawns `vite preview` against the built `dist/`, captures every slide
 * via Puppeteer, and writes `export.pdf` into the project root.
 */
export default async function exportPdf(projectRoot) {
  const outPath = path.join(projectRoot, 'export.pdf')
  console.log(`Exporting PDF to ${outPath}`)

  const server = await preview({
    root: projectRoot,
    preview: { port: 0, strictPort: false },
  })

  const url = server.resolvedUrls?.local?.[0]
  if (!url) {
    server.httpServer.close()
    throw new Error('Could not determine preview server URL')
  }

  try {
    const browser = await puppeteer.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(`${url}?pdf=true`, { waitUntil: 'networkidle0' })
      await page.emulateMediaType('screen')

      await page.pdf({
        path: outPath,
        printBackground: true,
        width: '1920px',
        height: '1080px',
      })
    } finally {
      await browser.close()
    }
  } finally {
    server.httpServer.close()
  }
}
