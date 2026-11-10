// Review tooling. Renders SVG assets at chosen moments of their loop, and the README as GitHub would show it.
//   node tools/shots.mjs sheet <file.svg ...> [--times 0.5,3,6,10] [--width 880] [--scheme dark] [--cols 2]
//   node tools/shots.mjs preview [--width 896] [--scheme dark] [--wait 6000] [--open] [--tile 1500]
// Output goes to .impeccable/review/.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '.impeccable', 'review')
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PAGE = { dark: '#0d1117', light: '#ffffff' }

const [mode, ...rest] = process.argv.slice(2)
const files = rest.filter(a => !a.startsWith('--') && a.endsWith('.svg'))
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i < 0 ? fallback : rest[i + 1]
}
const flag = name => rest.includes(`--${name}`)
const scheme = opt('scheme', 'dark')
const width = Number(opt('width', mode === 'preview' ? 896 : 880))

fs.mkdirSync(REVIEW, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: flag('reduced') ? 'reduce' : 'no-preference' }])

// Freeze every CSS and SMIL animation at t seconds into its timeline.
const seek = t =>
  page.evaluate(sec => {
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = sec * 1000
    }
    for (const s of document.querySelectorAll('svg')) {
      s.pauseAnimations?.()
      s.setCurrentTime?.(sec)
    }
  }, t)

if (mode === 'sheet') {
  const times = opt('times', '0.5,3,6,10').split(',').map(Number)
  const cols = Number(opt('cols', 2))
  for (const file of files) {
    const markup = fs.readFileSync(file, 'utf8').replace(/<svg([^>]*?) width="[^"]*" height="[^"]*"/, '<svg$1')
    await page.setViewport({ width: width + 32, height: 900, deviceScaleFactor: 1 })
    await page.setContent(`<body style="margin:16px;background:${PAGE[scheme]}"><div id="a" style="width:${width}px;line-height:0">${markup}</div></body>`)
    const el = await page.$('#a')
    const shots = []
    for (const t of times) {
      await seek(t)
      shots.push([t, await el.screenshot({ encoding: 'base64' })])
    }
    const cell = Math.round(width / cols)
    await page.setContent(
      `<body style="margin:12px;background:${PAGE[scheme]};font:12px monospace;color:#8b949e"><div id="s" style="display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:10px">` +
        shots.map(([t, b]) => `<div><div>t = ${t}s</div><img src="data:image/png;base64,${b}" style="width:${cell}px;display:block"></div>`).join('') +
        '</div></body>',
    )
    const out = path.join(REVIEW, `sheet-${path.basename(file, '.svg')}.png`)
    await (await page.$('#s')).screenshot({ path: out })
    console.log(out)
  }
} else if (mode === 'preview') {
  const md = path.join(ROOT, 'profile', 'README.md')
  let html = execFileSync('gh', ['api', 'markdown', '-f', 'mode=gfm', '-F', `text=@${md}`], { encoding: 'utf8', maxBuffer: 1 << 26 })
  // Point the published image URLs at the local build.
  html = html.replace(/https:\/\/raw\.githubusercontent\.com\/SerSan-Studio\/\.github\/main\/profile\/assets/g, '../../profile/assets')
  const c = scheme === 'dark' ? { bg: PAGE.dark, fg: '#e6edf3', bd: '#30363d', link: '#4493f8' } : { bg: PAGE.light, fg: '#1f2328', bd: '#d1d9e0', link: '#0969da' }
  const pad = width < 600 ? 16 : 24
  const doc = `<!doctype html><meta charset="utf-8"><title>README preview</title><style>
body{margin:0;background:${c.bg};color:${c.fg};font:16px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
.md{box-sizing:border-box;max-width:${width}px;margin:0 auto;padding:${pad}px}
h2{margin:24px 0 16px;padding-bottom:.3em;border-bottom:1px solid ${c.bd};font-size:1.5em;line-height:1.25}
p,ul,details{margin:0 0 16px}ul{padding-left:2em}li+li{margin-top:.25em}
a{color:${c.link};text-decoration:none}img{max-width:100%;box-sizing:content-box}summary{cursor:pointer}sub{font-size:75%}
</style><div class="md">${html}</div>`
  const file = path.join(REVIEW, `preview-${scheme}.html`)
  fs.writeFileSync(file, doc)
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  if (flag('open')) await page.evaluate(() => document.querySelectorAll('details').forEach(d => (d.open = true)))
  // Chrome only runs the animations of SVG images that are on screen, so the whole page becomes the viewport.
  const full = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewport({ width, height: full, deviceScaleFactor: 1 })
  await new Promise(r => setTimeout(r, Number(opt('wait', 6000))))
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  const tile = Number(opt('tile', 1500))
  const name = `${width < 600 ? 'mobile' : 'desktop'}-${scheme}${flag('open') ? '-open' : ''}`
  for (let y = 0, i = 1; y < total; y += tile, i++) {
    const out = path.join(REVIEW, `${name}-${i}.png`)
    await page.screenshot({ path: out, clip: { x: 0, y, width, height: Math.min(tile, total - y) }, captureBeyondViewport: true })
    console.log(out)
  }
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.currentSrc || i.src))
  console.log(`page height ${total}px · images ${await page.evaluate(() => document.images.length)} · broken ${broken.length}${broken.length ? '\n' + broken.join('\n') : ''}`)
} else if (mode === 'clip') {
  // A frame-exact recording of one asset's loop: seek, capture, encode with ffmpeg.
  const fps = Number(opt('fps', 20))
  const seconds = Number(opt('seconds', 14))
  for (const file of files) {
    const name = path.basename(file, '.svg')
    const dir = path.join(REVIEW, `frames-${name}`)
    fs.mkdirSync(dir, { recursive: true })
    const markup = fs.readFileSync(file, 'utf8').replace(/<svg([^>]*?) width="[^"]*" height="[^"]*"/, '<svg$1')
    await page.setViewport({ width: width + 32, height: 900, deviceScaleFactor: 1 })
    await page.setContent(`<body style="margin:16px;background:${PAGE[scheme]}"><div id="a" style="width:${width}px;line-height:0">${markup}</div></body>`)
    const el = await page.$('#a')
    for (let i = 0; i < fps * seconds; i++) {
      await seek(i / fps)
      await el.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.png`) })
    }
    const out = path.join(REVIEW, `${name}.mp4`)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%04d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', out])
    console.log(out)
  }
} else {
  console.error('usage: node tools/shots.mjs sheet <file.svg ...> | clip <file.svg ...> | preview')
  process.exitCode = 1
}
await browser.close()
