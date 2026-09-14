// Silkscreen micrographics for slide backgrounds, inspired by the Oxide
// board's bottom silkscreen. Written against the play.core program model so it
// runs on the ascii-shader engine and stays portable to mitos. Ported from the
// OXCON display (oxcon26).
import type { Program } from '@oxide/ascii-shader'

// -- Seeded RNG (mulberry32) --------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// -- Reference designators ----------------------------------------------------

// Weighted like a real board: caps and resistors everywhere, the rest sparse.
const PREFIXES = ['C', 'C', 'C', 'R', 'R', 'R', 'U', 'L', 'D', 'J', 'Q', 'Y'] as const

function refDes(rng: Rng, prefix?: string): string {
  const p = prefix ?? pick(rng, PREFIXES)
  // Caps/resistors run into four digits on this board (C1714, R1468).
  const max = p === 'C' || p === 'R' ? 1799 : 120
  return `${p}${randInt(rng, 1, max)}`
}

// -- Motifs -------------------------------------------------------------------
// Each motif renders to an array of equal-purpose lines; spaces are
// transparent when stamped, so nearby motifs can interleave visually.

type Motif = (rng: Rng) => string[]

/** `   L18` over `┌───────┐` — a labelled component edge. */
const bracketLabel: Motif = (rng) => {
  const inner = randInt(rng, 5, 9)
  const label = refDes(rng, pick(rng, ['L', 'U', 'J'] as const))
  const bar = `┌${'─'.repeat(inner)}┐`
  const pad = Math.max(0, Math.floor((bar.length - label.length) / 2))
  return [' '.repeat(pad) + label, bar]
}

/** `┌──────── R109` — a leader line calling out a part. */
const callout: Motif = (rng) => {
  const len = randInt(rng, 5, 12)
  const label = refDes(rng)
  return rng() < 0.5 ? [`┌${'─'.repeat(len)} ${label}`] : [`${label} ${'─'.repeat(len)}┐`]
}

/** R333 / R336 / R337 — a stack of same-prefix refs with uneven increments. */
const labelStack: Motif = (rng) => {
  const prefix = pick(rng, ['R', 'C'] as const)
  const count = randInt(rng, 2, 4)
  let n = randInt(rng, 10, 1400)
  const lines: string[] = []
  for (let i = 0; i < count; i++) {
    lines.push(`${prefix}${n}`)
    n += randInt(rng, 1, 4)
  }
  return lines
}

/** Open fiducial corners: `┌─    ─┐` over a gap over `└─    ─┘`. */
const fiducial: Motif = (rng) => {
  const gap = randInt(rng, 2, 4)
  const mid = ' '.repeat(gap)
  return [`┌─${mid}─┐`, '', `└─${mid}─┘`]
}

/** `[Y7]` — crystal-style bracketed ref. */
const bracketRef: Motif = (rng) => [`[${refDes(rng, pick(rng, ['Y', 'Q', 'D'] as const))}]`]

/** Electrolytic cap outline with paired labels, `+` polarity mark on top. */
const capOutline: Motif = (rng) => {
  const a = refDes(rng, 'C')
  const b = refDes(rng, 'C')
  const lines = [`┌  ┐${a}`, `│  │${b}`, '└  ┘']
  return rng() < 0.5 ? [' +', ...lines] : lines
}

/** Bare ref designator floating on its own. */
const bareRef: Motif = (rng) => [refDes(rng)]

/** `| D109` — pin-1 bar beside an LED/diode ref. */
const pinBar: Motif = (rng) => [`| ${refDes(rng, 'D')}`]

/** Net names that show up as test-point labels on the reference. */
const netName: Motif = (rng) => [
  pick(rng, [
    'GND',
    '54V_RTN',
    'V3P3_SYS_A2',
    'SVI HEADER',
    'POWER_CONT2',
    'MCIO 02',
  ] as const),
]

// Weighted motif deck — bracket/callout/stack shapes dominate, exotics sparse.
const MOTIFS: readonly Motif[] = [
  bracketLabel,
  bracketLabel,
  callout,
  callout,
  labelStack,
  labelStack,
  fiducial,
  bracketRef,
  capOutline,
  bareRef,
  bareRef,
  bareRef,
  pinBar,
  netName,
]

// -- Layout / animation ---------------------------------------------------------

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function intersects(a: Rect, b: Rect, padX: number, padY: number): boolean {
  return (
    a.x - padX < b.x + b.w &&
    a.x + a.w + padX > b.x &&
    a.y - padY < b.y + b.h &&
    a.y + a.h + padY > b.y
  )
}

function measure(lines: string[]): { w: number; h: number } {
  return {
    w: Math.max(...lines.map((l) => l.length), 1),
    h: lines.length,
  }
}

/** Inset from the grid edge, in program cells. */
const INSET = 1
/** Positions snap to a 8-cell lattice (2 background cells) for harmony. */
const SNAP = 8
/** Dissolve length, in frames, for both in and out (~1s at the 12fps setting). */
const FADE_FRAMES = 3

interface PlacedMotif {
  id: number
  rect: Rect
  lines: string[]
  /** Frame the in-dissolve starts (can be in the future for staggering). */
  born: number
  /** Frame the out-dissolve started, or null while live. */
  dying: number | null
  /** Permanent motifs (the date stamp) never cycle out. */
  permanent: boolean
}

// Per-cell hash for the dissolve mask: each character gets a stable threshold
// in [0, 1), so a motif materialises cell by cell in a fixed random order and
// dissolves out in the reverse of some other motif's order.
function cellHash(x: number, y: number, id: number): number {
  let n = (x * 73856093) ^ (y * 19349663) ^ (id * 83492791)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

// -- Program ------------------------------------------------------------------

export type SilkscreenOptions = {
  /** Frames between churn ticks: one motif out, one in, per cycle. */
  cycleFrames?: number
  /** Right-aligned stamp pinned bottom-right; empty array for none. */
  stamp?: string[]
}

/**
 * play.core program scattering silkscreen micrographics over the cell grid,
 * constantly churning: every `cycleFrames` frames one motif dissolves out and
 * (half a cycle later) a fresh one dissolves in elsewhere. The stamp
 * (`OXCON 09_2026` by default) is pinned bottom-right and never cycles out.
 */
export function createSilkscreenProgram({
  cycleFrames = 72,
  stamp = ['  OXCON', '09_2026'],
}: SilkscreenOptions = {}): Program {
  let raster: string[] = []
  let motifs: PlacedMotif[] = []
  let w = 0
  let h = 0
  let nextId = 1
  let rng: Rng = mulberry32(Date.now() >>> 0)

  const targetCount = () => Math.round((w * h) / 1260)

  // Generate a motif and find it a lattice-snapped home clear of the others.
  const spawn = (frame: number, born = frame): boolean => {
    const lines = pick(rng, MOTIFS)(rng)
    const { w: mw, h: mh } = measure(lines)
    const maxX = w - INSET - mw
    const maxY = h - INSET - mh
    if (maxX < INSET || maxY < INSET) return false
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = Math.round(randInt(rng, INSET, maxX) / SNAP) * SNAP
      const y = Math.round(randInt(rng, INSET, maxY) / SNAP) * SNAP
      if (x < INSET || x > maxX || y < INSET || y > maxY) continue
      const rect = { x, y, w: mw, h: mh }
      // Generous padding keeps the board sparse, like the real silkscreen.
      // Dying motifs still block their spot until fully dissolved.
      if (motifs.some((m) => intersects(rect, m.rect, 4, 2))) continue
      motifs.push({
        id: nextId++,
        rect,
        lines,
        born,
        dying: null,
        permanent: false,
      })
      return true
    }
    return false
  }

  const populate = (frame: number) => {
    motifs = []
    // The stamp: pinned bottom-right (inside the inset), right-aligned.
    if (stamp.length > 0) {
      const { w: mw, h: mh } = measure(stamp)
      motifs.push({
        id: nextId++,
        rect: { x: w - INSET - mw, y: h - INSET - mh, w: mw, h: mh },
        lines: stamp,
        born: frame,
        dying: null,
        permanent: true,
      })
    }
    // Initial scatter, with staggered births so the board assembles gradually.
    const count = targetCount()
    for (let n = 0; n < count; n++) {
      spawn(frame, frame + randInt(rng, 0, FADE_FRAMES * 3))
    }
  }

  return {
    settings: { fps: 12 },
    pre(context) {
      const frame = context.frame
      if (context.cols !== w || context.rows !== h) {
        w = context.cols
        h = context.rows
        raster = Array.from({ length: w * h }, () => ' ')
        populate(frame)
      }

      // Churn: spawn at the top of each cycle, retire the oldest at the half
      // cycle, guarded by the density target so failed spawns don't drain the
      // board and a shrinking target doesn't overfill it.
      const live = motifs.filter((m) => !m.permanent && m.dying === null)
      if (frame % cycleFrames === 0 && live.length <= targetCount()) {
        spawn(frame)
      }
      if (
        frame % cycleFrames === Math.floor(cycleFrames / 2) &&
        live.length >= targetCount()
      ) {
        live[0].dying = frame
      }
      // Drop motifs that have fully dissolved out, freeing their spot.
      motifs = motifs.filter((m) => m.dying === null || frame - m.dying < FADE_FRAMES)

      // Repaint the raster with each motif masked by its dissolve progress.
      raster.fill(' ')
      for (const m of motifs) {
        let p = Math.min(1, (frame - m.born) / FADE_FRAMES)
        if (m.dying !== null) p = Math.min(p, 1 - (frame - m.dying) / FADE_FRAMES)
        if (p <= 0) continue
        for (let j = 0; j < m.lines.length; j++) {
          const line = m.lines[j]
          for (let i = 0; i < line.length; i++) {
            if (line[i] === ' ') continue
            const cx = m.rect.x + i
            const cy = m.rect.y + j
            if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue
            if (p < 1 && cellHash(cx, cy, m.id) >= p) continue
            raster[cy * w + cx] = line[i]
          }
        }
      }
    },
    main({ index }) {
      return raster[index] ?? ' '
    },
  }
}
