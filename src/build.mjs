// Generates every SVG asset and the organization profile README.
// Run: node src/build.mjs            (ASSET_BASE overrides where the README points for images)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Ink, loadFonts, measure, wrap } from './type.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'profile', 'assets')
const BASE = (process.env.ASSET_BASE ?? 'https://raw.githubusercontent.com/SerSan-Studio/.github/main/profile/assets').replace(/\/$/, '')
const SITE = 'https://www.sersan.io'

// ---------- copy (taken from the live site, sersan.io) ----------

const FIT = [
  {
    good: 'Something in the business costs you time or money today.',
    bad: 'You want a chatbot gimmick for a press release.',
    body: '**Problem.** It starts with one problem worth solving: the manual work, the spreadsheet nobody trusts, the thing that keeps breaking. We map what you actually have, not what the org chart says.',
  },
  {
    good: 'You can explain the workflow, even if not the technology.',
    bad: 'No one can explain what problem is actually being solved.',
    body: '**Scope.** We find what should not be built before code becomes debt. We scope it before anyone writes code: cost, risk, effort, and what it actually saves. Sometimes the honest answer is to build less, or nothing.',
  },
  {
    good: 'You’d rather fix one real problem than buy another licence.',
    bad: 'You want a fixed price before anyone has defined the work.',
    body: '**The brief.** Start with the problem, build the smallest useful solution, scale what works. A brief gets a written next step, read by a founder, with a verdict: build, harden or stop. [See what you get](#brief).',
  },
  {
    good: 'Someone on your side can decide and unblock us, technical or not.',
    bad: 'Nobody can actually decide, so nothing gets signed off.',
    body: '**Build.** Then we design and build the system: internal tools, integrations, automations, web and mobile apps, and AI where it earns its place. You work with the builders. Every engagement has a named commercial owner and a named technical owner.',
  },
  {
    good: 'You want it built properly, whether or not you’re regulated.',
    bad: 'You want to skip compliance to ship faster.',
    body: '**Proof.** Working software is the only proof. We measure whether it saved the time or the money it was meant to. Monitoring, human review and rollback paths are wired in from day one. We do not claim compliance certifications we don’t hold; we do build systems that pass them.',
  },
  {
    good: 'You can give us the people, data or access to understand it.',
    bad: 'You won’t give us the access or feedback the work needs.',
    body: '**Handover.** We hand over something you can run. You own the code and the system, documented and handed over so whoever runs it day to day actually can. We train them, and we stay reachable.',
  },
]

const CODE = [
  [{ s: '// after your brief', c: 'mute' }],
  [{ s: 'const ', c: 'key' }, { s: 'whatYouGet', c: 'ink' }, { s: ' = {', c: 'mute' }],
  [{ s: '  readBy', c: 'ink' }, { s: ': ', c: 'mute' }, { s: '"a founder"', c: 'str' }, { s: ',', c: 'mute' }],
  [{ s: '  price', c: 'ink' }, { s: ': ', c: 'mute' }, { s: '"free"', c: 'str' }, { s: ',', c: 'mute' }],
  [{ s: '  deliverable', c: 'ink' }, { s: ': ', c: 'mute' }, { s: '"a written next step"', c: 'str' }, { s: ',', c: 'mute' }],
  [{ s: '  verdict', c: 'ink' }, { s: ': ', c: 'mute' }, { s: '"build | harden | stop"', c: 'str' }, { s: ',', c: 'mute' }],
  [{ s: '}', c: 'mute' }],
]

const HEADINGS = {
  fit: [[{ str: 'We are honest about ' }, { str: 'who we work with.', emph: true }]],
  artifacts: [[{ str: 'Three things every SerSan system ships with,' }], [{ str: 'scaled to what it actually carries.', emph: true }]],
  services: [[{ str: 'Four services. ' }, { str: 'One discipline.', emph: true }]],
  work: [[{ str: 'Engineering you can ' }, { str: 'name.', emph: true }]],
  brief: [[{ str: 'Bring us the problem. ' }, { str: 'We’ll bring the plan.', emph: true }]],
}

// ---------- tokens (from the site's globals.css) ----------

function hsl(h, s, l) {
  s /= 100
  l /= 100
  const k = i => (i + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = i => l - a * Math.max(-1, Math.min(k(i) - 3, Math.min(9 - k(i), 1)))
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

const C = {
  bg: hsl(216, 51, 9),
  surface: hsl(216, 30, 13),
  ink: hsl(220, 38, 97),
  mute: hsl(219, 14, 60),
  rule: hsl(216, 24, 18),
  hair: hsl(216, 30, 32),
  cyan: hsl(189, 100, 62),
  blue: hsl(216, 100, 58),
  refusal: hsl(12, 65, 58),
  keyword: '#7FB0FF',
}

// Transparent assets sit on GitHub's own page colour, so they come in two inks.
const THEMES = {
  dark: { ink: C.ink, mute: C.mute, rule: C.hair, signal: C.cyan, trail: C.blue, emph: C.cyan, refusal: C.refusal, markU: '#F4F6FA', markL: '#4FA3F7' },
  light: { ink: '#132741', mute: '#586273', rule: '#C9D1DD', signal: '#2A7FFF', trail: '#132741', emph: '#1F6FD0', refusal: '#BF4F28', markU: '#132741', markL: '#2280DC' },
}

const EASE = {
  out: 'cubic-bezier(.215,.61,.355,1)',
  entrance: 'cubic-bezier(.16,1,.3,1)',
  lock: 'cubic-bezier(.35,0,0,1)',
  inOut: 'cubic-bezier(.645,.045,.355,1)',
}

// ---------- helpers ----------

const n = v => String(Math.round(v * 100) / 100)
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const pathOf = pts => 'M' + pts.map(p => `${n(p[0])} ${n(p[1])}`).join('L')
const lengthOf = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)

// stops: [[seconds, 'declarations'], ...] inside a loop of T seconds.
const kf = (name, T, stops) =>
  `@keyframes ${name}{${stops.map(([t, d]) => `${n((Math.max(0, Math.min(T, t)) / T) * 100)}%{${d}}`).join('')}}`

// A short bright dash that travels a path during each [start, end] run and stays hidden between runs.
// `lead` lets a short head and a long trail share one leading edge.
function comet({ cls, d, len, T, runs, color, width = 2.4, tail = 40, lead = 0, opacity = 1 }) {
  const hidden = tail + 6
  const end = -(len + 6 + lead)
  const stops = [[0, `stroke-dashoffset:${n(hidden)}`]]
  for (const [a, b] of runs) stops.push([a, `stroke-dashoffset:${n(hidden)}`], [b, `stroke-dashoffset:${n(end)}`], [b + 0.01, `stroke-dashoffset:${n(hidden)}`])
  stops.push([T, `stroke-dashoffset:${n(hidden)}`])
  return {
    css: `.${cls}{stroke-dasharray:${n(tail)} ${n(len + tail + lead + 40)};stroke-dashoffset:${n(hidden)};animation:${cls} ${T}s linear infinite}${kf(cls, T, stops)}`,
    svg: `<path class="${cls}" d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`,
  }
}

// Opacity that is `on` inside each window and `off` elsewhere.
function gate(cls, T, wins, { fade = 0.2, on = 1, off = 0 } = {}) {
  const stops = [[0, `opacity:${off}`]]
  for (const [a, b] of wins) stops.push([a - fade, `opacity:${off}`], [a, `opacity:${on}`], [b, `opacity:${on}`], [b + fade, `opacity:${off}`])
  stops.push([T, `opacity:${off}`])
  return `.${cls}{animation:${cls} ${T}s linear infinite}${kf(cls, T, stops)}`
}

function svg({ w, h, title, desc, ink, defs = '', css = '', body }) {
  const motion = css ? `<style>${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t${desc ? ' d' : ''}"><title id="t">${esc(title)}</title>${desc ? `<desc id="d">${esc(desc)}</desc>` : ''}<defs>${ink ? ink.defs() : ''}${defs}${motion}</defs>${body}</svg>\n`
}

// Rounded midnight slab with a hairline edge; content is clipped to it.
function slab(w, h, inner) {
  return {
    defs: `<clipPath id="slab"><rect width="${w}" height="${h}" rx="22"/></clipPath>`,
    body: `<g clip-path="url(#slab)"><rect width="${w}" height="${h}" fill="${C.bg}"/>${inner}</g><rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="21.25" fill="none" stroke="${C.hair}" stroke-opacity=".55" stroke-width="1.5"/>`,
  }
}

// The mark: a hexagon made of two chevrons, in a 162.38 x 200 box (site favicon geometry).
const MARK_U = 'M81.19 0L162.38 46.88L127.3 67.13L81.19 40.51L39.64 64.49L39.64 90.03L80.11 113.4L40.6 136.21L0 112.78L0 46.88Z'
const MARK_L = 'M81.19 200L0 153.13L35.08 132.87L81.19 159.49L122.73 135.51L122.73 109.97L82.27 86.6L121.78 63.79L162.38 87.22L162.38 153.13Z'
const MARK_HULL = 'M81.19 0L162.38 46.88L162.38 153.13L81.19 200L0 153.13L0 46.88Z'
const MARK_W = 162.38

// `cls` names the two chevrons so one instance can be animated without touching the others.
function mark(x, y, h, upper, lower, extra = '', cls = '') {
  const c = s => (cls ? ` class="${cls}${s}"` : '')
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${(h / 200).toFixed(4)})"><path${c('u')} d="${MARK_U}" fill="${upper}"/><path${c('l')} d="${MARK_L}" fill="${lower}"/>${extra}</g>`
}

// Mark plus the SERSAN wordmark, proportioned as the site's lockup: cap height 0.42 of the mark, tracking 0.3 em.
function lockup(ink, x, y, h, t) {
  const cap = 0.42 * h
  const word = ink.text('SERSAN', { font: 'brand', size: cap / 0.7, x: x + (MARK_W * h) / 200 + 0.6 * cap, y: y + h / 2 + cap / 2, tracking: 0.3, fill: t.ink })
  return mark(x, y, h, t.markU, t.markL) + word.svg
}

const ARROW = 'M0 0H15M9 -6L15 0L9 6'

// ---------- hero ----------

function hero() {
  const W = 1200
  const H = 660
  const T = 14
  const t = THEMES.dark
  const ink = new Ink()
  let css = ''

  // Headline as the site sets it: Fraunces 500, tight tracking, the last word in the accent.
  const rows = [[{ str: 'We build' }], [{ str: 'the software' }], [{ str: 'your business' }], [{ str: 'is ' }, { str: 'missing.', fill: C.cyan }]]
  const head = rows
    .map((parts, i) => `<g class="rise r${i}">${ink.line(parts.map(p => ({ ...p, font: 'serif' })), { size: 98, x: 72, y: 224 + i * 97, tracking: -0.03, fill: C.ink }).svg}</g>`)
    .join('')
  css += `.rise{animation:rise 1.1s ${EASE.entrance} both}${rows.map((_, i) => `.r${i}{animation-delay:${n(0.12 + i * 0.09)}s}`).join('')}.r9{animation-delay:.62s}@keyframes rise{from{opacity:0;transform:translateY(18px)}}`
  const sub = ink.text('Custom software, automation & AI · For founders & SMEs · London', { font: 'sans', size: 25, x: 72, y: 612, fill: C.mute })

  // System map: six tools the business already runs, wired toward a hexagonal gap.
  const cx = 925
  const cy = 318
  const mh = 150
  const mk = mh / 200
  const mw = MARK_W * mk
  const mx = cx - mw / 2
  const my = cy - mh / 2
  const V = { top: [cx, my], bot: [cx, my + mh], tl: [mx, my + 46.88 * mk], br: [mx + mw, my + 153.13 * mk], lm: [mx, cy], rm: [mx + mw, cy] }
  const TAN = Math.tan(Math.PI / 3)
  const hd = (p, a) => [p, [a[0] + ((p[0] < a[0] ? -1 : 1) * Math.abs(a[1] - p[1])) / TAN, p[1]], a]
  const dh = (p, a) => [p, [p[0] + ((p[0] < a[0] ? 1 : -1) * Math.abs(a[1] - p[1])) / TAN, a[1]], a]
  const nodes = {
    crm: { p: [760, 150], label: 'CRM', side: -1, route: hd([760, 150], V.tl) },
    inbox: { p: [1010, 118], label: 'Inbox', side: 1, route: hd([1010, 118], V.top) },
    billing: { p: [1080, 262], label: 'Billing', side: 1, route: dh([1080, 262], V.rm) },
    sheets: { p: [1076, 430], label: 'Sheets', side: 1, route: hd([1076, 430], V.br) },
    erp: { p: [800, 520], label: 'ERP', side: -1, route: hd([800, 520], V.bot) },
    docs: { p: [742, 400], label: 'Docs', side: -1, route: dh([742, 400], V.lm) },
  }
  const wires = Object.values(nodes).map(nd => `<path d="${pathOf(nd.route)}" fill="none" stroke="${C.hair}" stroke-width="1.6"/>`).join('')

  // While the gap is open, signals arrive and stop at its edge.
  const dead = [['crm', [[0.25, 1.25], [1.75, 2.75]]], ['docs', [[0.6, 1.6], [2.1, 3.1]]], ['inbox', [[1.0, 2.0]]]]
  let deadSvg = ''
  dead.forEach(([key, runs], i) => {
    const r = nodes[key].route
    const c = comet({ cls: `in${i}`, d: pathOf(r), len: lengthOf(r), T, runs, color: C.mute, width: 2.2, tail: 34 })
    css += c.css
    deadSvg += c.svg
    const a = r[r.length - 1]
    const stops = [[0, 'opacity:0;transform:scale(.4)']]
    for (const [, b] of runs) stops.push([b - 0.12, 'opacity:0;transform:scale(.4)'], [b - 0.1, 'opacity:.75;transform:scale(.4)'], [b + 0.45, 'opacity:0;transform:scale(1.7)'])
    stops.push([T, 'opacity:0;transform:scale(1.7)'])
    css += `.pg${i}{transform-box:fill-box;transform-origin:center;animation:pg${i} ${T}s ${EASE.out} infinite}${kf(`pg${i}`, T, stops)}`
    deadSvg += `<circle class="pg${i}" cx="${n(a[0])}" cy="${n(a[1])}" r="7" fill="none" stroke="${C.mute}" stroke-width="1.6" opacity="0"/>`
  })

  // Once the mark is in, signals cross it and reach the tool on the other side.
  const through = [['crm', 'sheets', [[4.9, 6.7], [7.5, 9.3], [10.1, 11.9]]], ['docs', 'billing', [[5.5, 7.3], [8.3, 10.1]]], ['inbox', 'erp', [[6.2, 8.0], [9.0, 10.8]]]]
  let flowSvg = ''
  let blink = ''
  through.forEach(([from, to, runs], i) => {
    const pts = [...nodes[from].route, [cx, cy], ...[...nodes[to].route].reverse()]
    const d = pathOf(pts)
    const len = lengthOf(pts)
    const tr = comet({ cls: `tr${i}`, d, len, T, runs, color: C.blue, width: 2.2, tail: 120, opacity: 0.6 })
    const hdc = comet({ cls: `hd${i}`, d, len, T, runs, color: C.cyan, width: 2.8, tail: 34, lead: 86 })
    css += tr.css + hdc.css
    flowSvg += tr.svg + hdc.svg
    const [px, py] = nodes[to].p
    css += gate(`bk${i}`, T, runs.map(([, b]) => [b - 0.15, b + 0.45]), { fade: 0.18 })
    blink += `<rect class="bk${i}" x="${px - 15}" y="${py - 15}" width="30" height="30" rx="8" fill="${C.cyan}" fill-opacity=".22" stroke="${C.cyan}" stroke-width="1.8" opacity="0"/>`
  })

  // The two chevrons slide in and lock; near the end of the loop they release again.
  const away = (dx, dy) => `transform:translate(${dx}px,${dy}px);opacity:0`
  const chev = (name, dx, dy) =>
    `.${name}{animation:${name} ${T}s linear infinite}` +
    kf(name, T, [[0, away(dx, dy)], [3.2, `${away(dx, dy)};animation-timing-function:${EASE.lock}`], [3.75, 'opacity:1'], [4.6, 'transform:none;opacity:1'], [12.5, `transform:none;opacity:1;animation-timing-function:${EASE.inOut}`], [13.3, away(dx, dy)], [T, away(dx, dy)]])
  css += chev('cu', -74, -96) + chev('cl', 74, 96)
  css += `.sock{animation:sock ${T}s linear infinite,march 1.1s linear infinite}${kf('sock', T, [[0, 'opacity:.9'], [3.5, 'opacity:.9'], [4.5, 'opacity:0'], [12.9, 'opacity:0'], [13.6, 'opacity:.9'], [T, 'opacity:.9']])}@keyframes march{to{stroke-dashoffset:-20}}`
  css += `.ring{transform-box:fill-box;transform-origin:center;animation:ring ${T}s ${EASE.out} infinite}${kf('ring', T, [[0, 'opacity:0;transform:scale(1)'], [4.55, 'opacity:0;transform:scale(1)'], [4.6, 'opacity:.9;transform:scale(1)'], [5.9, 'opacity:0;transform:scale(1.5)'], [T, 'opacity:0;transform:scale(1.5)']])}`
  css += `.glow{animation:glow ${T}s linear infinite}${kf('glow', T, [[0, 'opacity:0'], [4.4, 'opacity:0'], [5.2, 'opacity:1'], [12.4, 'opacity:1'], [13.3, 'opacity:0'], [T, 'opacity:0']])}`
  const socket = `<path class="sock" d="${MARK_HULL}" fill="none" stroke="${C.mute}" stroke-width="${n(2 / mk)}" stroke-dasharray="10 10" opacity="0"/><path class="ring" d="${MARK_HULL}" fill="none" stroke="${C.cyan}" stroke-width="${n(2.4 / mk)}" opacity="0"/>`
  const piece = mark(mx, my, mh, t.markU, t.markL, socket, 'c')

  const boxes = Object.values(nodes)
    .map(nd => {
      const [px, py] = nd.p
      const label = ink.text(nd.label, { font: 'mono', size: 15, x: px + nd.side * 26, y: py + 5, anchor: nd.side < 0 ? 'end' : 'start', fill: C.mute })
      return `<rect x="${px - 14}" y="${py - 14}" width="28" height="28" rx="7" fill="${C.surface}" stroke="${C.hair}" stroke-width="1.5"/><circle cx="${px}" cy="${py}" r="3" fill="${C.mute}"/>${label.svg}`
    })
    .join('')

  // One signal leaves along the base rule each time the piece locks.
  const rule = [[72, 574], [1128, 574]]
  const out = comet({ cls: 'out', d: pathOf(rule), len: lengthOf(rule), T, runs: [[4.7, 6.5]], color: C.cyan, width: 2, tail: 90 })
  css += out.css

  const inner =
    `<circle class="glow" cx="${cx}" cy="${cy}" r="210" fill="url(#hg)"/>` +
    wires + deadSvg + flowSvg + piece + blink + boxes +
    `<path d="${pathOf(rule)}" stroke="${C.rule}" stroke-width="1.5"/>${out.svg}` +
    lockup(ink, 72, 58, 44, t) + head + `<g class="rise r9">${sub.svg}</g>`
  const s = slab(W, H, inner)
  return svg({
    w: W, h: H, ink, css,
    title: 'SerSan. We build the software your business is missing.',
    desc: 'A map of business tools wired toward a hexagonal gap. The two chevrons of the SerSan mark lock into the gap and signals start to pass between the tools.',
    defs: s.defs + `<radialGradient id="hg"><stop offset="0" stop-color="${C.blue}" stop-opacity=".2"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>`,
    body: s.body,
  })
}

// ---------- buttons ----------

function button({ label, kind, theme = 'dark', arrow = true }) {
  const t = THEMES[theme]
  const ink = new Ink()
  const H = 64
  const size = 22
  const face = kind === 'primary' ? 'sansB' : 'sansM'
  const tw = measure(label, face, size, -0.005)
  const W = Math.ceil(tw + (arrow ? 30 : 0) + 68)
  const fg = kind === 'primary' ? C.bg : t.ink
  const text = ink.text(label, { font: face, size, x: 34, y: 40, tracking: -0.005, fill: fg })
  let css = arrow ? `.ar{animation:ar 5s ${EASE.inOut} infinite}@keyframes ar{0%,72%,100%{transform:none}84%{transform:translateX(6px)}}` : ''
  const arrowSvg = arrow ? `<g class="ar"><path transform="translate(${n(34 + tw + 13)} 32)" d="${ARROW}" fill="none" stroke="${fg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>` : ''
  let plate
  let defs = ''
  if (kind === 'primary') {
    css += `.sh{animation:sh 5s ${EASE.inOut} infinite}@keyframes sh{0%,60%{transform:translateX(-90px)}82%,100%{transform:translateX(${W + 40}px)}}`
    defs = `<clipPath id="pl"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10"/></clipPath>`
    plate = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="${C.cyan}"/><g clip-path="url(#pl)"><path class="sh" d="M0 0H34L10 ${H}H-24Z" fill="#fff" fill-opacity=".38"/><path d="M11 2H${W - 11}" stroke="#fff" stroke-opacity=".5"/></g>`
  } else {
    plate = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="31" fill="none" stroke="${t.ink}" stroke-opacity=".3" stroke-width="1.5"/>`
  }
  return { w: W, h: H, svg: svg({ w: W, h: H, ink, css, defs, title: label, body: plate + text.svg + arrowSvg }) }
}

// ---------- section headings ----------

function heading(lines, theme) {
  const t = THEMES[theme]
  const ink = new Ink()
  const step = 66
  // Shrink a heading that would not fit the 1200-unit measure rather than let it clip.
  const widest = Math.max(...lines.map(l => measure(l.map(p => p.str).join(''), 'serifT', 58, -0.022)))
  const size = Math.min(58, Math.floor((58 * 1190) / widest))
  const body = lines
    .map((parts, i) => ink.line(parts.map(p => ({ str: p.str, font: 'serifT', fill: p.emph ? t.emph : undefined })), { size, x: 0, y: 52 + i * step, tracking: -0.022, fill: t.ink }).svg)
    .join('')
  return svg({ w: 1200, h: lines.length * step + 12, ink, title: lines.map(l => l.map(p => p.str).join('')).join(' '), body })
}

// ---------- the ledger of fit ----------

// Two layouts: a wide one for desktop and a narrow one whose type stays readable on a phone.
function fitRow(i, theme, narrow = false) {
  const t = THEMES[theme]
  const ink = new Ink()
  const T = 14
  const W = narrow ? 900 : 1200
  const size = 30
  const lh = 40
  const gx = 56
  const colW = narrow ? 384 : 492
  const mid = narrow ? 462 : 612
  const bx = mid + (narrow ? 24 : 52)
  const first = i === 0
  const good = wrap(FIT[i].good, 'sansM', size, colW)
  const bad = wrap(FIT[i].bad, 'sans', size, colW)
  const top = first ? 80 : 22
  const H = top + Math.max(good.length, bad.length) * lh + 14
  const base = j => top + 28 + j * lh
  const s = 0.5 + i * 0.4

  // Dash gaps are longer than the paths so no stray cap shows while a stroke is waiting to be drawn.
  let css = `.ck{stroke-dasharray:36 48;animation:ck ${T}s ${EASE.out} infinite}` + kf('ck', T, [[0, 'stroke-dashoffset:40;opacity:1'], [s, 'stroke-dashoffset:40'], [s + 0.45, 'stroke-dashoffset:0'], [13.1, 'stroke-dashoffset:0;opacity:1'], [13.6, 'stroke-dashoffset:0;opacity:0'], [T, 'stroke-dashoffset:0;opacity:0']])

  const goodSvg = good.map((str, j) => ink.text(str, { font: 'sansM', size, x: gx, y: base(j), fill: t.ink }).svg).join('')
  let badSvg = ''
  let strikes = ''
  bad.forEach((str, j) => {
    const line = ink.text(str, { font: 'sans', size, x: bx, y: base(j), fill: t.mute })
    badSvg += line.svg
    const len = line.width + 12
    const st = s + 0.5 + j * 0.3
    css += `.st${j}{stroke-dasharray:${n(len)} ${n(len + 12)};animation:st${j} ${T}s ${EASE.out} infinite}` + kf(`st${j}`, T, [[0, `stroke-dashoffset:${n(len + 5)};opacity:1`], [st, `stroke-dashoffset:${n(len + 5)}`], [st + 0.5, 'stroke-dashoffset:0;opacity:1'], [st + 1.4, 'opacity:.5'], [13.1, 'stroke-dashoffset:0;opacity:.5'], [13.6, 'stroke-dashoffset:0;opacity:0'], [T, 'stroke-dashoffset:0;opacity:0']])
    // The strike is drawn at full strength, then settles so the refused line stays readable.
    strikes += `<path class="st${j}" d="M${bx - 6} ${n(base(j) - 9.5)}H${n(bx + line.width + 6)}" stroke="${t.refusal}" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>`
  })

  const header = first
    ? ink.text('Good fit', { font: 'sansB', size: 21, x: gx, y: 34, fill: t.mute }).svg + ink.text('Not a fit', { font: 'sansB', size: 21, x: bx, y: 34, fill: t.mute }).svg + `<path d="M0 54H${W}" stroke="${t.rule}" stroke-width="1.5"/>`
    : ''
  const body =
    header +
    `<path d="M${mid} ${first ? 54 : 0}V${H}" stroke="${t.rule}" stroke-width="1.5"/><path d="M0 ${H - 0.75}H${W}" stroke="${t.rule}" stroke-width="1.5"/>` +
    `<path class="ck" transform="translate(10 ${n(base(0) - 21)})" d="M0 11L8 19L24 1" fill="none" stroke="${t.emph}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    goodSvg + badSvg + strikes
  return svg({ w: W, h: H, ink, css, title: `Good fit: ${FIT[i].good} Not a fit: ${FIT[i].bad}`, body })
}

// ---------- the three artifacts ----------

function artifactFrame({ title, caption, diagram, css = '', defs = '', desc }) {
  const ink = new Ink()
  const W = 1200
  const H = 300
  const head = title.map((str, i) => ink.text(str, { font: 'serifT', size: 46, x: 600, y: 140 + i * 54, tracking: -0.02, fill: C.ink }).svg).join('')
  const cap = ink.text(caption, { font: 'mono', size: 17, x: 64, y: 262, fill: C.mute })
  const d = diagram(ink, cap.width)
  const s = slab(W, H, `<path d="M560 40V260" stroke="${C.rule}" stroke-width="1.5"/>` + d.svg + cap.svg + head)
  return svg({ w: W, h: H, ink, css: css + (d.css ?? ''), defs: s.defs + defs, title: title.join(' '), desc, body: s.body })
}

function artifactEval() {
  const T = 12
  const cols = 8
  const rowsN = 3
  const cell = 34
  const pitch = 48
  const ox = 64
  const oy = 62
  const sweeps = [[0.6, 3.2], [4.6, 7.2], [8.6, 11.2]]
  const failing = { c: 5, r: 1, sweep: 1 }
  return artifactFrame({
    title: ['Proof it still works', 'after every change.'],
    caption: 'eval baseline',
    desc: 'A grid of test cases re-run after each change. On the second run one case fails; on the third it passes again.',
    diagram(ink, capW) {
      let css = ''
      let out = ''
      for (let r = 0; r < rowsN; r++) {
        for (let c = 0; c < cols; c++) {
          const cls = `c${r}${c}`
          const stops = [[0, `fill-opacity:0;fill:${C.cyan}`]]
          sweeps.forEach(([a, b], k) => {
            const hit = a + ((c + 0.5) / cols) * (b - a)
            const color = k === failing.sweep && c === failing.c && r === failing.r ? C.refusal : C.cyan
            const hold = k < sweeps.length - 1 ? sweeps[k + 1][0] - 0.25 : T - 0.5
            stops.push([hit - 0.02, `fill-opacity:0;fill:${color}`], [hit, `fill-opacity:1;fill:${color}`], [hit + 0.35, `fill-opacity:.5;fill:${color}`], [hold, `fill-opacity:.5;fill:${color}`], [hold + 0.2, `fill-opacity:0;fill:${color}`])
          })
          stops.push([T, `fill-opacity:0;fill:${C.cyan}`])
          css += `.${cls}{animation:${cls} ${T}s linear infinite}${kf(cls, T, stops)}`
          out += `<rect class="${cls}" x="${ox + c * pitch}" y="${oy + r * pitch}" width="${cell}" height="${cell}" rx="6" fill="${C.cyan}" fill-opacity=".5" stroke="${C.hair}" stroke-width="1.5"/>`
        }
      }
      const span = cols * pitch - (pitch - cell) + 16
      const stops = [[0, 'transform:none;opacity:0']]
      for (const [a, b] of sweeps) stops.push([a - 0.15, 'transform:none;opacity:0'], [a, 'transform:none;opacity:1'], [b, `transform:translateX(${span}px);opacity:1`], [b + 0.15, `transform:translateX(${span}px);opacity:0`], [b + 0.16, 'transform:none;opacity:0'])
      stops.push([T, 'transform:none;opacity:0'])
      css += `.scan{animation:scan ${T}s linear infinite}${kf('scan', T, stops)}`
      out += `<path class="scan" d="M${ox - 8} ${oy - 10}V${oy + rowsN * pitch - (pitch - cell) + 10}" stroke="${C.ink}" stroke-width="1.5" opacity="0"/>`
      const vx = 64 + capW + 12
      ;[[0.05, 4.35], [4.45, 8.35], [8.45, 11.95]].forEach((w, k) => {
        css += gate(`v${k}`, T, [w], { fade: 0.04 })
        out += `<g class="v${k}" opacity="${k === 2 ? 1 : 0}">${ink.text(`· v${k + 1}`, { font: 'mono', size: 17, x: vx, y: 262, fill: C.mute }).svg}</g>`
      })
      ;[['24 / 24', C.cyan, [3.3, 4.3]], ['23 / 24', C.refusal, [7.3, 8.3]], ['24 / 24', C.cyan, [11.3, 11.8]]].forEach(([str, color, w], k) => {
        css += gate(`rs${k}`, T, [w], { fade: 0.12 })
        out += `<g class="rs${k}" opacity="${k === 2 ? 1 : 0}">${ink.text(str, { font: 'monoM', size: 17, x: 500, y: 262, anchor: 'end', fill: color }).svg}</g>`
      })
      return { svg: out, css }
    },
  })
}

function artifactTrace() {
  const T = 10
  const xs = [100, 226, 352, 478]
  const y = 112
  const labels = ['in', 'decide', 'act', 'review']
  const hits = [0.8, 1.8, 2.8, 3.8]
  return artifactFrame({
    title: ['Traceable from input', 'to action.'],
    caption: 'trace propagation',
    desc: 'A signal crosses four steps: what came in, what was decided, what was done, who reviewed it. Each step leaves a recorded line.',
    diagram(ink) {
      let css = ''
      const line = [[xs[0], y], [xs[3], y]]
      let out = `<path d="${pathOf(line)}" stroke="${C.hair}" stroke-width="1.6"/>`
      const tr = comet({ cls: 'tt', d: pathOf(line), len: lengthOf(line), T, runs: [[hits[0], hits[3]]], color: C.blue, width: 2.2, tail: 110, opacity: 0.6 })
      const hd = comet({ cls: 'th', d: pathOf(line), len: lengthOf(line), T, runs: [[hits[0], hits[3]]], color: C.cyan, width: 2.8, tail: 30, lead: 80 })
      css += tr.css + hd.css
      out += tr.svg + hd.svg
      xs.forEach((x, k) => {
        const on = hits[k]
        css += `.nd${k}{animation:nd${k} ${T}s linear infinite}` + kf(`nd${k}`, T, [[0, 'opacity:0'], [on - 0.05, 'opacity:0'], [on + 0.15, 'opacity:1'], [9.1, 'opacity:1'], [9.6, 'opacity:0'], [T, 'opacity:0']])
        out += `<circle cx="${x}" cy="${y}" r="15" fill="${C.surface}" stroke="${C.hair}" stroke-width="1.6"/><circle class="nd${k}" cx="${x}" cy="${y}" r="15" fill="${C.cyan}" fill-opacity=".22" stroke="${C.cyan}" stroke-width="1.8"/><circle class="nd${k}" cx="${x}" cy="${y}" r="4" fill="${C.cyan}"/>`
        out += ink.text(labels[k], { font: 'mono', size: 16, x, y: 160, anchor: 'middle', fill: C.mute }).svg
        ;[54, 36, 46].forEach((w, j) => {
          const cls = `lg${k}${j}`
          const st = on + 0.2 + j * 0.16
          css += `.${cls}{transform-box:fill-box;transform-origin:0 50%;animation:${cls} ${T}s ${EASE.out} infinite}` + kf(cls, T, [[0, 'transform:scaleX(0);opacity:1'], [st, 'transform:scaleX(0)'], [st + 0.35, 'transform:scaleX(1)'], [9.1, 'transform:scaleX(1);opacity:1'], [9.6, 'transform:scaleX(1);opacity:0'], [T, 'transform:scaleX(1);opacity:0']])
          out += `<rect class="${cls}" x="${x - 27}" y="${182 + j * 12}" width="${w}" height="4" rx="2" fill="${j === 0 ? C.ink : C.mute}" fill-opacity="${j === 0 ? 0.85 : 0.6}"/>`
        })
      })
      return { svg: out, css }
    },
  })
}

function artifactClamp() {
  const T = 8
  const x0 = 64
  const x1 = 500
  const mid = 142
  const lim = 54
  const period = 480
  const amp = x => 60 + 34 * Math.sin((2 * Math.PI * x) / period)
  const pts = []
  for (let x = x0; x <= x1 + period; x += 5) pts.push([x, mid - amp(x) * Math.sin((2 * Math.PI * x) / 120)])
  const d = pathOf(pts)
  const w = x1 - x0
  return artifactFrame({
    title: ['Boundaries', 'before features.'],
    caption: 'guardrail clamp',
    desc: 'A signal runs between two limits. Whatever exceeds a limit is cut at the line; the part that was refused is drawn faintly beyond it.',
    css: `.wv{animation:wv ${T}s linear infinite}@keyframes wv{to{transform:translateX(-${period}px)}}`,
    defs:
      `<clipPath id="in"><rect x="${x0}" y="${mid - lim}" width="${w}" height="${lim * 2}"/></clipPath>` +
      `<clipPath id="over"><rect x="${x0}" y="${mid - 110}" width="${w}" height="${110 - lim}"/><rect x="${x0}" y="${mid + lim}" width="${w}" height="${110 - lim}"/></clipPath>` +
      `<linearGradient id="fd" gradientUnits="userSpaceOnUse" x1="${x0}" x2="${x1}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff"/><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<mask id="edge" maskUnits="userSpaceOnUse" x="${x0}" y="20" width="${w}" height="230"><rect x="${x0}" y="20" width="${w}" height="230" fill="url(#fd)"/></mask>`,
    diagram(ink) {
      const limit = yy => `<path d="M${x0} ${yy}H${x1}" stroke="${C.ink}" stroke-opacity=".7" stroke-width="1.6"/>`
      const out =
        `<g mask="url(#edge)"><g clip-path="url(#over)"><path class="wv" d="${d}" fill="none" stroke="${C.refusal}" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/></g><g clip-path="url(#in)"><path class="wv" d="${d}" fill="none" stroke="${C.cyan}" stroke-width="2.6" stroke-linejoin="round"/></g></g>` +
        limit(mid - lim) + limit(mid + lim) +
        ink.text('max', { font: 'mono', size: 15, x: x1 + 10, y: mid - lim + 5, fill: C.mute }).svg +
        ink.text('min', { font: 'mono', size: 15, x: x1 + 10, y: mid + lim + 5, fill: C.mute }).svg
      return { svg: out }
    },
  })
}

// ---------- the brief card ----------

// The narrow layout keeps only the code, so it stays readable on a phone.
function briefCard(narrow = false) {
  const W = narrow ? 780 : 1200
  const H = 452
  const T = 14
  const ink = new Ink()
  const size = 28
  const x0 = 72
  const lh = 46
  const y0 = 134
  const cw = measure('M', 'monoM', size)
  const colors = { ink: C.ink, mute: C.mute, key: C.keyword, str: C.cyan }
  let css = `.code{animation:code ${T}s linear infinite}` + kf('code', T, [[0, 'opacity:1'], [13, 'opacity:1'], [13.45, 'opacity:0'], [13.95, 'opacity:0'], [T, 'opacity:1']])
  let defs = ''
  let code = ''
  let at = 0.5
  CODE.forEach((parts, i) => {
    const chars = parts.reduce((s, p) => s + p.s.length, 0)
    const dur = Math.max(0.3, chars * 0.034)
    const cls = `ty${i}`
    css += `.${cls}{transform-box:fill-box;transform-origin:0 50%;animation:${cls} ${T}s linear infinite}` + kf(cls, T, [[0, 'transform:scaleX(0)'], [at, `transform:scaleX(0);animation-timing-function:steps(${chars},end)`], [at + dur, 'transform:scaleX(1)'], [13.5, 'transform:scaleX(1)'], [13.52, 'transform:scaleX(0)'], [T, 'transform:scaleX(0)']])
    defs += `<clipPath id="k${i}"><rect class="${cls}" x="${x0 - 2}" y="${y0 + i * lh - 34}" width="${n(chars * cw + 6)}" height="46"/></clipPath>`
    code += `<g clip-path="url(#k${i})">${ink.line(parts.map(p => ({ str: p.s, font: 'monoM', fill: colors[p.c] })), { size, x: x0, y: y0 + i * lh }).svg}</g>`
    at += dur + 0.08
  })

  // The verdict is one of three; the card walks through them.
  const vy = y0 + 5 * lh
  const options = [['build', 12, C.cyan], ['harden', 20, C.cyan], ['stop', 29, C.refusal]]
  const wins = [[6.9, 8.6], [8.8, 10.5], [10.7, 12.6]]
  let marks = ''
  options.forEach(([word, col, color], k) => {
    css += gate(`hl${k}`, T, [wins[k]], { fade: 0.15 })
    marks += `<rect class="hl${k}" x="${n(x0 + col * cw - 6)}" y="${vy - 31}" width="${n(word.length * cw + 12)}" height="42" rx="7" fill="${color}" fill-opacity=".2" stroke="${color}" stroke-opacity=".7" stroke-width="1.4" opacity="0"/>`
  })

  // Right: the same decision drawn as a junction with three exits.
  const J = [860, 244]
  const ex = 1004
  const dy = 96
  const kx = dy / Math.tan(Math.PI / 3)
  const exits = [[J, [J[0] + kx, J[1] - dy], [ex, J[1] - dy]], [J, [ex, J[1]]], [J, [J[0] + kx, J[1] + dy], [ex, J[1] + dy]]]
  let junction = `<path d="M772 ${J[1]}H${J[0]}" stroke="${C.hair}" stroke-width="1.6"/>`
  ;(narrow ? [] : exits).forEach((pts, k) => {
    const [word, , color] = options[k]
    const end = pts[pts.length - 1]
    const full = [[772, J[1]], ...pts]
    const c = comet({ cls: `ex${k}`, d: pathOf(full), len: lengthOf(full), T, runs: [[wins[k][0], wins[k][0] + 1.1]], color, width: 2.6, tail: 46 })
    css += c.css + `.lb${k}{animation:lb${k} ${T}s linear infinite}` + kf(`lb${k}`, T, [[0, 'opacity:.5'], [wins[k][0] + 0.6, 'opacity:.5'], [wins[k][0] + 1.0, 'opacity:1'], [wins[k][1], 'opacity:1'], [wins[k][1] + 0.3, 'opacity:.5'], [T, 'opacity:.5']])
    const tip = k === 2
      ? `<path d="M${end[0]} ${end[1] - 13}V${end[1] + 13}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
      : `<path transform="translate(${end[0] - 12} ${end[1]})" d="${ARROW}" fill="none" stroke="${C.mute}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    junction += `<path d="${pathOf(pts)}" fill="none" stroke="${C.hair}" stroke-width="1.6"/>` + c.svg + tip + `<g class="lb${k}" opacity=".85">${ink.text(word, { font: 'sansM', size: 27, x: ex + 22, y: end[1] + 9, fill: k === 2 ? C.refusal : C.ink }).svg}</g>`
  })
  junction += `<circle cx="${J[0]}" cy="${J[1]}" r="6" fill="${C.bg}" stroke="${C.ink}" stroke-width="1.8"/>`

  // The caret appears only once the last line is typed.
  css += `.cr{animation:cr 1.1s steps(1) infinite}@keyframes cr{50%{opacity:0}}.cg{animation:cg ${T}s linear infinite}` + kf('cg', T, [[0, 'opacity:0'], [at, 'opacity:0'], [at + 0.05, 'opacity:1'], [T, 'opacity:1']])
  const caret = `<g class="cg"><rect class="cr" x="${n(x0 + cw + 5)}" y="${y0 + 6 * lh - 25}" width="13" height="30" fill="${C.cyan}"/></g>`
  const tab = ink.text('what_you_get.ts', { font: 'mono', size: 18, x: x0, y: 62, fill: C.mute })
  const inner = tab.svg + `<path d="M0 86H${W}" stroke="${C.rule}" stroke-width="1.5"/><path d="M${x0} 85H${n(x0 + tab.width)}" stroke="${C.cyan}" stroke-width="2"/>` + marks + `<g class="code">${code}${caret}</g>` + (narrow ? '' : junction)
  const s = slab(W, H, inner)
  return svg({
    w: W, h: H, ink, css, defs: s.defs + defs, body: s.body,
    title: 'What you get after a brief: a written next step, read by a founder, free, with a verdict of build, harden or stop.',
  })
}

// ---------- divider and footer ----------

function divider(theme) {
  const t = THEMES[theme]
  const T = 7
  const line = [[0, 14], [1200, 14]]
  const tr = comet({ cls: 'dt', d: pathOf(line), len: 1200, T, runs: [[0.4, 3.6]], color: t.trail, width: 2, tail: 150, opacity: 0.55 })
  const hd = comet({ cls: 'dh', d: pathOf(line), len: 1200, T, runs: [[0.4, 3.6]], color: t.signal, width: 2.4, tail: 46, lead: 104 })
  return svg({
    w: 1200, h: 28, css: tr.css + hd.css, title: 'Divider',
    body: `<path d="M0 14H586M614 14H1200" stroke="${t.rule}" stroke-width="1.5"/>${tr.svg}${hd.svg}<path d="M600 5L608 9.6V18.4L600 23L592 18.4V9.6Z" fill="none" stroke="${t.rule}" stroke-width="1.5"/>`,
  })
}

function footer() {
  const W = 1200
  const H = 270
  const T = 9
  const t = THEMES.dark
  const ink = new Ink()
  const mh = 126
  const my = (H - mh) / 2
  const css = `.sw{animation:sw ${T}s ${EASE.inOut} infinite}` + kf('sw', T, [[0, 'transform:translate(-140px,0)'], [1.2, 'transform:translate(-140px,0)'], [3.4, 'transform:translate(260px,0)'], [T, 'transform:translate(260px,0)']])
  const sweep = `<g clip-path="url(#low)"><path class="sw" d="M0 -40H70L10 260H-60Z" fill="#fff" fill-opacity=".55"/></g>`
  // Mark and sign-off are centred as one group.
  const lines = ['The intelligence is artificial.', 'The judgement stays human.']
  const textW = Math.max(...lines.map(str => measure(str, 'serifT', 46, -0.02)))
  const markW = (MARK_W * mh) / 200
  const left = (W - (markW + 60 + textW)) / 2
  const l1 = ink.text(lines[0], { font: 'serifT', size: 46, x: left + markW + 60, y: 122, tracking: -0.02, fill: C.mute })
  const l2 = ink.text(lines[1], { font: 'serifT', size: 46, x: left + markW + 60, y: 180, tracking: -0.02, fill: C.ink })
  const s = slab(W, H, mark(left, my, mh, t.markU, t.markL, sweep) + l1.svg + l2.svg)
  return svg({ w: W, h: H, ink, css, defs: s.defs + `<clipPath id="low"><path d="${MARK_L}"/></clipPath>`, body: s.body, title: 'The intelligence is artificial. The judgement stays human.' })
}

// ---------- README ----------

function readme(sizes) {
  const B = BASE
  const pic = (name, alt, attrs) => `<picture><source media="(prefers-color-scheme: dark)" srcset="${B}/${name}-dark.svg"><img src="${B}/${name}-light.svg" ${attrs} alt="${esc(alt)}"></picture>`
  const solo = (name, alt) => `<picture><img src="${B}/${name}.svg" width="100%" alt="${esc(alt)}"></picture>`
  const bw = k => `width="${Math.round((sizes[k].w * 46) / 64)}" height="46"`
  const h2 = (id, key) => `<h2 id="${id}">${pic(`h-${key}`, HEADINGS[key].map(l => l.map(p => p.str).join('')).join(' '), 'width="100%"')}</h2>`
  const rule = `<p>${pic('divider', '', 'width="100%"')}</p>`
  // Dense assets also ship a narrow layout. The browser picks by viewport width; either one is acceptable if it does not.
  const wide = '(min-width: 768px)'
  const row = (k, alt) =>
    `<picture><source media="${wide} and (prefers-color-scheme: dark)" srcset="${B}/fit-${k}-dark.svg"><source media="${wide}" srcset="${B}/fit-${k}-light.svg"><source media="(prefers-color-scheme: dark)" srcset="${B}/fit-${k}-narrow-dark.svg"><img src="${B}/fit-${k}-narrow-light.svg" width="94%" align="middle" alt="${esc(alt)}"></picture>`
  const rows = FIT.map(
    (f, i) => `<details name="fit"${i === 0 ? ' open' : ''}>
<summary>${row(i + 1, `Good fit: ${f.good} Not a fit: ${f.bad}`)}</summary>
<br>

${f.body}

</details>`,
  ).join('\n\n')

  return `<div align="center">

<a href="${SITE}"><img src="${B}/hero.svg" width="100%" alt="SerSan. We build the software your business is missing. Custom software, automation and AI for founders and SMEs. London."></a>

<p>
<a href="${SITE}/start"><img src="${B}/btn-brief.svg" ${bw('brief')} alt="Send a project brief"></a>
&nbsp;
<a href="#selected-work">${pic('btn-work', 'See selected work', bw('work'))}</a>
</p>

</div>

SerSan is a founder-led studio for founders, SMEs and growing teams. We build custom software, workflow automation and AI: from one manual workflow to a full production platform, with the honest answer about which one you need.

${rule}

${h2('fit', 'fit')}

Each row sets a good fit beside what we turn down. Open a row to read how that part of the work runs.

${rows}

${h2('artifacts', 'artifacts')}

Not a list of compliance buzzwords. Each one is scaled to the system, and each is an artifact you can ask to see in any scoping call.

${solo('artifact-eval', 'Eval baseline. Proof it still works after every change: a grid of test cases re-run after each change.')}

Versioned test cases, sized to the system: a handful for a workflow tool, a full regression set for a platform. You prove it, instead of hoping.

${solo('artifact-trace', 'Trace propagation. Traceable from input to action: a signal crosses four steps and each leaves a recorded line.')}

When something goes wrong, the answer is in the record: what came in, what it decided, what it did, who reviewed it. Not Slack archaeology.

${solo('artifact-clamp', 'Guardrail clamp. Boundaries before features: a signal is cut wherever it exceeds its limits.')}

What the system can reach (data, accounts, actions) is agreed before the first feature. The default answer to an unscoped action is no.

${h2('services', 'services')}

Start with the problem. Build the smallest useful solution. Scale what works.

- **[Custom Software & Platforms](${SITE}/services/engineering).** The software your business runs on, built to fit: internal tools and management systems, customer portals and web applications, SaaS products and academy or LMS platforms, integrations across the tools you use.
- **[Workflow Automation](${SITE}/services/automation).** Start with the process that eats the most time: repetitive back-office work handed off, documents read, checked and filed, leads, orders and CRM data kept in sync, failures surfaced and retried.
- **[AI Features & Reliability](${SITE}/services/mlops).** AI that holds up once real customers use it: assistants and copilots on your own content, agents that act within the limits you set, tested against real cases before release, monitored live for cost, quality and accuracy.
- **[Technical Audits & Architecture](${SITE}/services/architecture).** Find what should not be built, before code becomes debt: a systems and process audit, a build, buy or don't-build call, where AI would actually pay off, a target architecture that is sequenced and costed.

${h2('selected-work', 'work')}

Four projects the site labels SerSan delivery. The [full archive](${SITE}/case-studies) also lists prior senior delivery, labelled as such.

- **[SphereNode](${SITE}/case-studies/spherenode)** · FinTech · Trading Education · RAG Mentor · Community · CRM
- **[Quantex.live](${SITE}/case-studies/quantex)** · FinTech · Quant · LLM Agents · Real-Time Data
- **[Domus Tua](${SITE}/case-studies/domus-tua)** · Real Estate · Brand Site · Motion Design · Lead Generation
- **[Terra Noa](${SITE}/case-studies/terra-noa)** · Agritech · Renewables · IoT · Predictive Maintenance · SCADA

Most of what we build belongs to clients and stays private.

${h2('brief', 'brief')}

One workflow, one product idea, one system that keeps breaking, or something your team still does manually. Tell us what's happening. We'll tell you what we'd do next.

<picture><source media="${wide}" srcset="${B}/brief.svg"><img src="${B}/brief-narrow.svg" width="100%" alt="what_you_get.ts. After your brief: read by a founder, price free, deliverable a written next step, verdict build, harden or stop."></picture>

<p align="center">
<a href="${SITE}/start"><img src="${B}/btn-brief.svg" ${bw('brief')} alt="Send a project brief"></a>
&nbsp;
<a href="mailto:alex.s@sersan.dev?subject=Project%20brief">${pic('btn-email', 'Email us', bw('email'))}</a>
&nbsp;
<a href="${SITE}">${pic('btn-site', 'sersan.io', bw('site'))}</a>
</p>

<p align="center">Reply within one business day.</p>

${rule}

${solo('footer', 'The intelligence is artificial. The judgement stays human.')}

<p align="center"><sub>© 2026 Sersan Limited · 128 City Road, London EC1V 2NX · Co. No. 16878386 · <a href="https://www.linkedin.com/company/sersan-limited">LinkedIn</a></sub></p>
`
}

// ---------- build ----------

await loadFonts()
fs.mkdirSync(OUT, { recursive: true })
const written = []
const emit = (name, content) => {
  fs.writeFileSync(path.join(OUT, name), content)
  written.push([name, Buffer.byteLength(content)])
}
const both = fn => ['dark', 'light'].forEach(fn)

emit('hero.svg', hero())
const brief = button({ label: 'Send a project brief', kind: 'primary' })
emit('btn-brief.svg', brief.svg)
const sizes = { brief }
for (const [key, label, arrow] of [['work', 'See selected work', true], ['email', 'Email us', false], ['site', 'sersan.io', true]]) {
  both(th => {
    const b = button({ label, kind: 'secondary', theme: th, arrow })
    sizes[key] = b
    emit(`btn-${key}-${th}.svg`, b.svg)
  })
}
for (const [key, lines] of Object.entries(HEADINGS)) both(th => emit(`h-${key}-${th}.svg`, heading(lines, th)))
FIT.forEach((_, i) =>
  both(th => {
    emit(`fit-${i + 1}-${th}.svg`, fitRow(i, th))
    emit(`fit-${i + 1}-narrow-${th}.svg`, fitRow(i, th, true))
  }),
)
emit('artifact-eval.svg', artifactEval())
emit('artifact-trace.svg', artifactTrace())
emit('artifact-clamp.svg', artifactClamp())
emit('brief.svg', briefCard())
emit('brief-narrow.svg', briefCard(true))
both(th => emit(`divider-${th}.svg`, divider(th)))
emit('footer.svg', footer())

const readmePath = path.join(ROOT, 'profile', 'README.md')
fs.writeFileSync(readmePath, readme(sizes))

for (const [name, bytes] of written) console.log(String(bytes).padStart(7), name)
console.log(`${written.length} assets, ${(written.reduce((s, [, b]) => s + b, 0) / 1024).toFixed(0)} KB · README ${fs.statSync(readmePath).size} bytes · images from ${BASE}`)
