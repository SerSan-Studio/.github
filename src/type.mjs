// Brand typography as outlines. SVG assets are shown through <img>, where web fonts
// cannot load, so every string is laid out with the real font files and emitted as paths.
import * as fontkit from 'fontkit'
import fs from 'node:fs'
import path from 'node:path'
import wawoff2 from 'wawoff2'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NM = path.join(ROOT, 'node_modules')
const CACHE = path.join(ROOT, '.cache', 'fonts')
const FRAUNCES = path.join(NM, '@fontsource-variable', 'fraunces', 'files')
const JBM = path.join(NM, '@fontsource', 'jetbrains-mono', 'files')

// Fraunces as the site sets it: weight 500 with optical sizing on, so the optical size follows
// the size the text is actually shown at (about 72 px for the hero, about 40 px for headings).
const fraunces = opsz => ({ file: path.join(FRAUNCES, 'fraunces-latin-full-normal.woff2'), vary: { wght: 500, opsz, SOFT: 0, WONK: 0 } })

const SOURCES = {
  serif: fraunces(72),
  serifT: fraunces(40),
  sans: { file: path.join(CACHE, 'switzer-400.woff2') },
  sansM: { file: path.join(CACHE, 'switzer-500.woff2') },
  sansB: { file: path.join(CACHE, 'switzer-600.woff2') },
  mono: { file: path.join(JBM, 'jetbrains-mono-latin-400-normal.woff2') },
  monoM: { file: path.join(JBM, 'jetbrains-mono-latin-500-normal.woff2') },
  brand: { file: path.join(CACHE, 'sersan-display-340.woff2') },
}

const loaded = new Map()

// fontkit cannot instance a variable font straight from WOFF2, so those files are
// decompressed to TrueType first.
// Switzer and the SERSAN display face are not redistributed in this repository: they are fetched
// once from the public site repository and kept in .cache/fonts.
const REMOTE = 'https://raw.githubusercontent.com/SerSan-Studio/Sersan/main/src/fonts/'
async function ensure(file) {
  if (fs.existsSync(file)) return
  if (!file.startsWith(CACHE)) throw new Error(`missing font file ${file}: run npm install`)
  const res = await fetch(REMOTE + path.basename(file))
  if (!res.ok) throw new Error(`could not fetch ${path.basename(file)}: HTTP ${res.status}`)
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

export async function loadFonts() {
  for (const [key, src] of Object.entries(SOURCES)) {
    if (loaded.has(key)) continue
    await ensure(src.file)
    const raw = fs.readFileSync(src.file)
    let f
    if (src.vary) {
      const ttf = Buffer.from(await wawoff2.decompress(raw))
      f = fontkit.create(ttf).getVariation(src.vary)
    } else f = fontkit.create(raw)
    loaded.set(key, f)
  }
}

export function font(key) {
  const f = loaded.get(key)
  if (!f) throw new Error(`font "${key}" is not loaded; call loadFonts() first`)
  return f
}

const r1 = n => Math.round(n * 10) / 10

function shape(str, key, tracking) {
  const f = font(key)
  const run = f.layout(str)
  const extra = tracking * f.unitsPerEm
  const glyphs = []
  let x = 0
  run.glyphs.forEach((g, i) => {
    const p = run.positions[i]
    glyphs.push({ g, x: x + p.xOffset, y: p.yOffset })
    x += p.xAdvance + (i < run.glyphs.length - 1 ? extra : 0)
  })
  return { f, glyphs, units: x }
}

export function measure(str, key = 'sans', size = 32, tracking = 0) {
  const { f, units } = shape(str, key, tracking)
  return (units * size) / f.unitsPerEm
}

export function capHeight(key, size) {
  const f = font(key)
  return (f.capHeight * size) / f.unitsPerEm
}

// Greedy word wrap against real advance widths.
export function wrap(str, key, size, maxWidth, tracking = 0) {
  const lines = []
  let line = ''
  for (const word of str.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next, key, size, tracking) > maxWidth) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// One Ink per SVG file: it collects each glyph outline once and hands out <use> references.
export class Ink {
  constructor() {
    this.glyphs = new Map()
  }

  ref(key, g) {
    const id = `${key}${g.id}`
    if (!this.glyphs.has(id)) {
      const d = g.path.toSVG().replace(/-?\d*\.\d+/g, m => String(Math.round(Number(m))))
      this.glyphs.set(id, d)
    }
    return id
  }

  // parts: [{ str, font }] set on one baseline. Returns the markup and the measured width.
  line(parts, { size = 32, x = 0, y = 0, anchor = 'start', tracking = 0, fill = 'currentColor', attrs = '' } = {}) {
    const shaped = parts.map(p => ({ ...shape(p.str, p.font ?? 'sans', tracking), key: p.font ?? 'sans', fill: p.fill }))
    const widths = shaped.map(s => (s.units * size) / s.f.unitsPerEm)
    const gap = tracking * size
    const width = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, parts.length - 1)
    let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
    let out = ''
    shaped.forEach((s, i) => {
      const k = size / s.f.unitsPerEm
      const uses = s.glyphs
        .filter(it => it.g.path.commands.length)
        .map(it => `<use href="#${this.ref(s.key, it.g)}" x="${Math.round(it.x)}"${it.y ? ` y="${Math.round(it.y)}"` : ''}/>`)
        .join('')
      out += `<g transform="translate(${r1(cx)} ${r1(y)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})"${s.fill ? ` fill="${s.fill}"` : ''}>${uses}</g>`
      cx += widths[i] + gap
    })
    return { svg: `<g fill="${fill}"${attrs ? ' ' + attrs : ''}>${out}</g>`, width }
  }

  text(str, opts = {}) {
    return this.line([{ str, font: opts.font ?? 'sans' }], opts)
  }

  defs() {
    return [...this.glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')
  }
}
