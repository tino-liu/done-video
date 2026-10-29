// Frame-based animation helpers. Every value on screen is a pure function of the frame number, so
// any frame can be rendered on its own, in any order, by any worker.
import { FPS } from "./timeline"

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

export type Easing = (t: number) => number

export const Ease = {
  linear: (t: number) => t,
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
} satisfies Record<string, Easing>

/** Maps f from [f0, f1] onto [v0, v1], clamped, with easing. */
export function interp(f: number, [f0, f1]: [number, number], [v0, v1]: [number, number] = [0, 1], easing: Easing = Ease.inOut) {
  if (f1 <= f0) return f >= f1 ? v1 : v0
  return v0 + (v1 - v0) * easing(clamp((f - f0) / (f1 - f0)))
}

/** Piecewise interpolation through [frame, value] keys. */
export function keys(f: number, points: Array<[number, number]>, easing: Easing = Ease.inOut) {
  if (f <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    if (f <= points[i][0]) return interp(f, [points[i - 1][0], points[i][0]], [points[i - 1][1], points[i][1]], easing)
  }
  return points[points.length - 1][1]
}

/** A damped spring from 0 to 1 starting at frame 0. */
export function spring(f: number, { stiffness = 170, damping = 20, mass = 1 } = {}) {
  if (f <= 0) return 0
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const t = f / FPS
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
}

/** Entrance: 0 → 1 over `len` frames from `at`. */
export const enter = (f: number, at: number, len = 10, easing: Easing = Ease.out) => interp(f, [at, at + len], [0, 1], easing)

export const DEFAULT_CPS = 18

/** The part of `text` typed by frame f when typing starts at `at`. */
export function typed(text: string, f: number, at: number, cps = DEFAULT_CPS) {
  return text.slice(0, Math.max(0, Math.floor(((f - at) * cps) / FPS)))
}

/** The frame typing of `text` finishes. */
export const typedEnd = (text: string, at: number, cps = DEFAULT_CPS) => at + Math.ceil((text.length * FPS) / cps)

/** A caret that blinks at about 1 Hz. */
export const caretOn = (f: number) => Math.floor(f / 16) % 2 === 0

export const sec = (s: number) => Math.round(s * FPS)
