// Generates the BataVasa logo + app icons from a single vector source.
//
// Concept: the four-point "spark" (the ✨ universal Add / AI-insight mark used
// throughout the app) sits at the centre of an orbit ring — the personal OS,
// with your modules (finance, habits, journals, reminders) revolving around
// one calm core. The warm amber spark rides the orbit: a single data point
// becoming an insight. Calm teal = trust; amber = emotion (the emotion ↔
// spending link at the heart of Finance).
//
// Run:  node scripts/gen-logo.mjs
// Needs a resvg-js install (npm i --no-save @resvg/resvg-js, or set RESVG_PATH).

import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

// resvg is resolved from wherever this script is launched (temp install ok).
const resvgSpec = process.env.RESVG_PATH
  ? (isAbsolute(process.env.RESVG_PATH) ? pathToFileURL(process.env.RESVG_PATH).href : process.env.RESVG_PATH)
  : '@resvg/resvg-js'
const { Resvg } = await import(resvgSpec)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(ROOT, 'assets')

// ── Brand palette (from design/tokens.ts) ────────────────────────────────────
const TEAL_TOP = '#3C8488' // brighter teal (top of bg gradient)
const TEAL_MID = '#2F6F73' // brand.primary
const TEAL_BTM = '#1E4A4E' // deep teal-green (bottom)
const CREAM = '#F7F4EE' // bg.primary — orbit ring
const CREAM_LO = '#E8F0EC' // cool cream (hero gradient foot)
const AMBER_HI = '#F3C682'
const AMBER = '#D9A15C' // accent (dark-theme accent — brighter on teal)

// ── Four-point spark path, centred at (cx,cy) ────────────────────────────────
// Sharp tips on the axes, concave sides curving toward the centre.
function spark(cx, cy, r, sx = 1, sy = 1) {
  const X = (v) => +(cx + v * r * sx).toFixed(2)
  const Y = (v) => +(cy + v * r * sy).toFixed(2)
  // control magnitudes: small across-axis, larger along-axis → slim arms
  const a = 0.06
  const b = 0.2
  return [
    `M ${X(0)} ${Y(-1)}`,
    `C ${X(a)} ${Y(-b)} ${X(b)} ${Y(-a)} ${X(1)} ${Y(0)}`,
    `C ${X(b)} ${Y(a)} ${X(a)} ${Y(b)} ${X(0)} ${Y(1)}`,
    `C ${X(-a)} ${Y(b)} ${X(-b)} ${Y(a)} ${X(-1)} ${Y(0)}`,
    `C ${X(-b)} ${Y(-a)} ${X(-a)} ${Y(-b)} ${X(0)} ${Y(-1)}`,
    'Z',
  ].join(' ')
}

// Point on the orbit at angle θ (degrees, screen coords: y grows downward).
function onOrbit(deg, r = ORBIT.r) {
  const t = (deg * Math.PI) / 180
  return { x: +(S / 2 + r * Math.cos(t)).toFixed(1), y: +(S / 2 + r * Math.sin(t)).toFixed(1) }
}

// Composition on a 1024 canvas, centred — calm and balanced.
const S = 1024
const HERO = { cx: S / 2, cy: S / 2, r: 330, sx: 0.95, sy: 1.06 }
const ORBIT = { r: 270, width: 12 }
// Amber spark rides the orbit at the upper right (−45°); the ring opens
// around it. A small moon-dot balances it on the opposite diagonal.
const AMBER_AT = -45
const GAP_HALF = 27 // degrees of ring hidden either side of the amber spark
const ACCENT = { ...((p) => ({ cx: p.x, cy: p.y }))(onOrbit(AMBER_AT)), r: 96, sx: 0.97, sy: 1.05 }
const DOT = { ...onOrbit(135), r: 13 }

function defs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="${S}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${TEAL_TOP}"/>
      <stop offset="0.52" stop-color="${TEAL_MID}"/>
      <stop offset="1" stop-color="${TEAL_BTM}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${HERO.cx}" cy="${HERO.cy - 16}" r="460" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#BFF0E6" stop-opacity="0.20"/>
      <stop offset="0.6" stop-color="#BFF0E6" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#BFF0E6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="amberGlow" cx="${ACCENT.cx}" cy="${ACCENT.cy}" r="160" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${AMBER_HI}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${AMBER_HI}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hero" x1="0" y1="${HERO.cy - HERO.r}" x2="0" y2="${HERO.cy + HERO.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="${CREAM_LO}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="${ACCENT.cy - ACCENT.r}" x2="0" y2="${ACCENT.cy + ACCENT.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${AMBER_HI}"/>
      <stop offset="1" stop-color="${AMBER}"/>
    </linearGradient>
  </defs>`
}

// Orbit ring as a single arc that opens around the amber spark.
function orbitArc() {
  const a = onOrbit(AMBER_AT + GAP_HALF) // clockwise start, just below the gap
  const b = onOrbit(AMBER_AT - GAP_HALF) // clockwise end, just above the gap
  return `M ${a.x} ${a.y} A ${ORBIT.r} ${ORBIT.r} 0 1 1 ${b.x} ${b.y}`
}

function marks(scale) {
  const t = `translate(${S / 2} ${S / 2}) scale(${scale}) translate(${-S / 2} ${-S / 2})`
  return `
  <g transform="${t}">
    <circle cx="${HERO.cx}" cy="${HERO.cy - 16}" r="460" fill="url(#glow)"/>
    <path d="${orbitArc()}" fill="none" stroke="${CREAM}" stroke-opacity="0.42" stroke-width="${ORBIT.width}" stroke-linecap="round"/>
    <circle cx="${DOT.x}" cy="${DOT.y}" r="${DOT.r}" fill="${CREAM}" fill-opacity="0.7"/>
    <path d="${spark(HERO.cx, HERO.cy, HERO.r, HERO.sx, HERO.sy)}" fill="url(#hero)"/>
    <circle cx="${ACCENT.cx}" cy="${ACCENT.cy}" r="160" fill="url(#amberGlow)"/>
    <path d="${spark(ACCENT.cx, ACCENT.cy, ACCENT.r, ACCENT.sx, ACCENT.sy)}" fill="url(#accent)"/>
  </g>`
}

// rounded: clip to an iOS-style squircle with transparent margins.
function buildSVG({ rounded = false, markScale = 1 } = {}) {
  const rx = +(S * 0.2237).toFixed(1)
  const clip = rounded
    ? `<clipPath id="sq"><rect x="0" y="0" width="${S}" height="${S}" rx="${rx}" ry="${rx}"/></clipPath>`
    : ''
  const open = rounded ? `<g clip-path="url(#sq)">` : '<g>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${defs()}
  ${clip}
  ${open}
    <rect x="0" y="0" width="${S}" height="${S}" fill="url(#bg)"/>
    ${marks(markScale)}
  </g>
</svg>`
}

function png(svg, size) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
  return r.render().asPng()
}

// ── Outputs ──────────────────────────────────────────────────────────────────
const full = buildSVG({ rounded: false, markScale: 1 }) // OS rounds corners itself
const adaptive = buildSVG({ rounded: false, markScale: 0.74 }) // mark inside safe zone
const rounded = buildSVG({ rounded: true, markScale: 1 }) // self-contained badge

writeFileSync(join(ASSETS, 'logo.svg'), rounded) // canonical source for README/branding
writeFileSync(join(ASSETS, 'icon.png'), png(full, 1024))
writeFileSync(join(ASSETS, 'adaptive-icon.png'), png(adaptive, 1024))
writeFileSync(join(ASSETS, 'splash-icon.png'), png(rounded, 1024))
writeFileSync(join(ASSETS, 'favicon.png'), png(rounded, 96))

console.log('wrote assets/logo.svg, icon.png, adaptive-icon.png, splash-icon.png, favicon.png')
