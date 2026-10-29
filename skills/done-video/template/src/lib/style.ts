// What scenes and overlays draw with: the theme's surfaces, type and motion. Use these instead of fixed
// colours, radii, shadows and spring settings, so switching the theme restyles the whole video.
import type { CSSProperties } from "react"

import { Ease, enter, spring } from "./anim"
import type { Easing } from "./anim"
import { theme } from "./theme"
import type { Theme } from "./theme"

export { theme }

/** The accent at `percent` opacity, for glows, rings and tints. */
export const accentA = (percent: number) => `color-mix(in srgb, var(--color-accent) ${percent}%, transparent)`

/** The second brand colour at `percent` opacity. */
export const glowA = (percent: number) => `color-mix(in srgb, var(--color-glow) ${percent}%, transparent)`

type Size = "card" | "small" | "window"

const SOFT: Record<Theme["mode"], Record<Size, string>> = {
  dark: { card: "0 30px 80px rgba(0,0,0,0.45)", small: "0 10px 28px rgba(0,0,0,0.30)", window: "0 40px 90px rgba(0,0,0,0.55)" },
  light: {
    card: "0 24px 60px rgba(17,24,39,0.12), 0 2px 8px rgba(17,24,39,0.06)",
    small: "0 8px 22px rgba(17,24,39,0.10)",
    window: "0 40px 90px rgba(17,24,39,0.20), 0 2px 10px rgba(17,24,39,0.08)",
  },
}
const HARD_OFFSET: Record<Size, number> = { card: 8, small: 4, window: 12 }

/** The theme's shadow for a card, a small box or the browser window. A hard shadow is a solid offset copy in the border colour;
 *  `spread` widens it to cover a ring drawn with box-shadow rather than a border. */
export function shadow(size: Size, spread = 0) {
  if (theme.shadow === "none") return "none"
  if (theme.shadow === "hard") return `${HARD_OFFSET[size]}px ${HARD_OFFSET[size]}px 0 ${spread}px var(--color-border)`
  return SOFT[theme.mode][size]
}

const GLASS_BLUR = 10
/** Captions and callouts are smaller than cards, so their corners are too. */
const BOX_RADIUS_RATIO = 0.75

/** `card` also rounds accent bars and rules; `chip` is only for pills and badges. */
export const radius = { card: theme.shape.radius, box: Math.round(theme.shape.radius * BOX_RADIUS_RATIO), chip: theme.shape.chip }

/** A card, pill (`chip`) or caption-sized box in the theme's material, border, corners and shadow. */
export function surface(kind: "card" | "box" | "chip"): CSSProperties {
  return {
    background: "var(--color-surface)",
    border: `${theme.shape.border}px solid var(--color-border)`,
    borderRadius: radius[kind],
    boxShadow: shadow(kind === "card" ? "card" : "small"),
    backdropFilter: theme.material === "glass" ? `blur(${GLASS_BLUR}px)` : undefined,
  }
}

/** Headlines and names on cards. */
export const display: CSSProperties = { fontFamily: "var(--font-display)", fontWeight: theme.text.displayWeight, letterSpacing: theme.text.displayTracking }

/** Small labels such as "Step 1 of 3" and "PBI #123 · Done". Write them in sentence case; the theme sets the case. */
export const label: CSSProperties = {
  fontFamily: theme.text.labelFont === "mono" ? "var(--font-mono)" : "var(--font-sans)",
  textTransform: theme.text.labelCase === "uppercase" ? "uppercase" : "none",
  letterSpacing: theme.text.labelTracking,
  fontWeight: theme.text.labelWeight,
}

/** Left inset of the title cards when the theme aligns them to the start. */
const START_INSET = 200

/** Lays out the intro, title and outro cards: centred, or down the left like an editorial page. */
export const align = theme.align === "start" ? { className: "items-start text-left", style: { paddingLeft: START_INSET } } : { className: "items-center text-center", style: {} }

type Motion = { speed: number; damping: number; ease: Easing; pop: Easing }

/** speed scales durations; damping 26 and up settles without overshoot (stiffness 170, mass 1). */
const MOTION: Record<Theme["motion"], Motion> = {
  springy: { speed: 1, damping: 15, ease: Ease.out, pop: Ease.outBack },
  smooth: { speed: 1, damping: 26, ease: Ease.out, pop: Ease.out },
  snappy: { speed: 0.65, damping: 30, ease: Ease.outQuint, pop: Ease.outQuint },
  calm: { speed: 1.6, damping: 30, ease: Ease.inOut, pop: Ease.inOut },
}

const m = MOTION[theme.motion]

/** 0 → 1 over `len` frames from `at`, at the theme's pace. For text and fades. */
export const appear = (f: number, at: number, len = 12) => enter(f, at, Math.round(len * m.speed), m.ease)

/** Like appear, but overshoots in a springy theme. For pills and badges. */
export const pop = (f: number, at: number, len = 10) => enter(f, at, Math.round(len * m.speed), m.pop)

/** A spring from 0 to 1 starting at `at`, with the theme's bounce. For cards and logos. */
export const settle = (f: number, at: number) => spring((f - at) / m.speed, { damping: m.damping })
