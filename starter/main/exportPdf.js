import puppeteer from 'puppeteer'

;(async () => {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('http://localhost:1337/?pdf=true', { waitUntil: 'networkidle0' })
  await page.emulateMediaType('screen')

  const pdf = await page.pdf({
    path: 'export.pdf',
    printBackground: true,
    width: '1920px',
    height: '1080px',
  })

  await browser.close()
  return pdf
})()
