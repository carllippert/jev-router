import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const html = pathToFileURL(resolve(import.meta.dirname, 'card.html')).href
const out = resolve(import.meta.dirname, 'jev-router.png')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } })
await page.goto(html)
await page.locator('.card').screenshot({ path: out })
await browser.close()
console.log(out)
