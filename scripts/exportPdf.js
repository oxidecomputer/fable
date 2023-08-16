import puppeteer from 'puppeteer'

const run = async (__dirname) => {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('http://localhost:1337/?pdf=true', { waitUntil: 'networkidle0' })
  await page.emulateMediaType('screen')

  const pdf = await page.pdf({
    path: `${__dirname}/export.pdf`,
    printBackground: true,
    width: '1920px',
    height: '1080px',
  })

  await browser.close()
  return pdf
}

async function exportPdf(directory) {
  console.log(`Exporting PDF to ${directory}`)
  await run(directory)
}

export default exportPdf
