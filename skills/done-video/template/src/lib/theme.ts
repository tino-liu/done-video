// The look of everything around the product's screens: the backdrop, cards, pills, captions, callouts
// and how they move. Each theme is a JSON file in src/themes/. video.config.json names the one to use,
// and ?theme=<name> overrides it in the player, still.mjs and render.mjs.
import config from "../../video.config.json"

export type Theme = {
  mode: "dark" | "light"
  colors: {
    background: string
    background2: string
    surface: string
    foreground: string
    muted: string
    border: string
    accent: string
    accentForeground: string
    glow: string
    success: string
  }
  /** CSS font-family stacks. Every family needs an @font-face, from src/fonts.css. */
  fonts: { display: string; body: string; mono: string }
  text: { displayWeight: number; displayTracking: string; labelCase: "uppercase" | "none"; labelTracking: string; labelWeight: number; labelFont: "body" | "mono" }
  shape: { radius: number; chip: number; border: number }
  material: "glass" | "solid"
  shadow: "soft" | "hard" | "none"
  backdrop: { style: "aurora" | "gradient" | "solid" | "image"; texture: "dots" | "grid" | "noise" | "none"; image?: string; dim: number }
  motion: "springy" | "smooth" | "snappy" | "calm"
  align: "center" | "start"
}

type Group = { [key: string]: unknown }
type ThemeFile = Group & { extends?: string }

const FILES = import.meta.glob<ThemeFile>("../themes/*.json", { eager: true, import: "default" })
const THEMES: Record<string, ThemeFile> = Object.fromEntries(Object.entries(FILES).map(([path, file]) => [path.replace(/^.*\/|\.json$/g, ""), file]))
export const themeNames = Object.keys(THEMES).sort()

const REQUIRED_COLORS = ["background", "foreground", "accent"] as const

/** Everything a theme may leave out, apart from colours, which are derived from the three it must set. */
const DEFAULTS = {
  fonts: { display: '"Inter Variable", sans-serif', body: '"Inter Variable", sans-serif', mono: '"IBM Plex Mono", monospace' },
  text: { displayWeight: 600, displayTracking: "-0.02em", labelCase: "uppercase", labelTracking: "0.12em", labelWeight: 600, labelFont: "body" },
  shape: { radius: 14, chip: 999, border: 1 },
  material: "solid",
  shadow: "soft",
  backdrop: { style: "gradient", texture: "none", dim: 0.35 },
  motion: "smooth",
  align: "center",
}

const CHOICES: Record<string, readonly string[]> = {
  mode: ["dark", "light"],
  material: ["glass", "solid"],
  shadow: ["soft", "hard", "none"],
  motion: ["springy", "smooth", "snappy", "calm"],
  align: ["center", "start"],
  "backdrop.style": ["aurora", "gradient", "solid", "image"],
  "backdrop.texture": ["dots", "grid", "noise", "none"],
  "text.labelCase": ["uppercase", "none"],
  "text.labelFont": ["body", "mono"],
}

const isGroup = (v: unknown): v is Group => typeof v === "object" && v !== null && !Array.isArray(v)

/** Merges b over a, one level deep, so a theme can change one colour without restating the rest. */
function merge(a: Group, b: Group): Group {
  const out: Group = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    out[k] = isGroup(v) && isGroup(prev) ? { ...prev, ...v } : v
  }
  return out
}

function load(input: string | ThemeFile, seen: string[] = []): Group {
  const name = typeof input === "string" ? input : undefined
  const file = name === undefined ? input : THEMES[name]
  if (!isGroup(file)) throw new Error(`[theme] No theme "${name}" in src/themes/. There are: ${themeNames.join(", ")}`)
  if (name && seen.includes(name)) throw new Error(`[theme] "${name}" extends itself: ${[...seen, name].join(" → ")}`)
  const { extends: base, ...own } = file
  return merge(base ? load(base, name ? [...seen, name] : seen) : DEFAULTS, own)
}

const canvas = document.createElement("canvas")
canvas.width = canvas.height = 1
const ctx = canvas.getContext("2d", { willReadFrequently: true })!

type Rgb = [number, number, number]

/** The pixel `color` paints over `under`, so a translucent colour is judged as it is seen. */
function paint(color: string, under = "#ffffff"): Rgb {
  ctx.fillStyle = under
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

const toHex = (rgb: Rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`

/** WCAG relative luminance. */
function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const DARK_LUMINANCE = 0.18
/** Text, including the small bold text in pills and callouts (WCAG 1.4.3). */
const TEXT_CONTRAST = 4.5
/** Marks that aren't text, such as highlight rings and the done tick (WCAG 1.4.11). */
const MARK_CONTRAST = 3
const INK = { dark: "#0b0b0b", light: "#ffffff" }
const SUCCESS = { dark: "#4ade80", light: "#15803d" }

/** Fills in the colours a theme left out from the three it must set. */
function deriveColors(colors: Group): Theme["colors"] {
  for (const key of REQUIRED_COLORS) if (typeof colors[key] !== "string") throw new Error(`[theme] colors.${key} is required`)
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== "string" || !CSS.supports("color", value)) throw new Error(`[theme] colors.${key} "${String(value)}" is not a CSS colour`)
  }
  const c = colors as Partial<Theme["colors"]> & Pick<Theme["colors"], (typeof REQUIRED_COLORS)[number]>
  const background = toHex(paint(c.background))
  const dark = luminance(paint(background)) < DARK_LUMINANCE
  const accent = paint(c.accent)
  const accentForeground = contrast(accent, paint(INK.light)) >= contrast(accent, paint(INK.dark)) ? INK.light : INK.dark
  return {
    background2: background,
    surface: `color-mix(in srgb, ${c.foreground} 6%, ${background})`,
    muted: `color-mix(in srgb, ${c.foreground} 62%, ${background})`,
    border: `color-mix(in srgb, ${c.foreground} 14%, transparent)`,
    accentForeground,
    glow: c.accent,
    success: dark ? SUCCESS.dark : SUCCESS.light,
    ...c,
  }
}

function validate(merged: Group): Theme {
  for (const [path, allowed] of Object.entries(CHOICES)) {
    const [group, key] = path.split(".")
    const value = key ? (isGroup(merged[group]) ? merged[group][key] : undefined) : merged[group]
    if (value !== undefined && !allowed.includes(String(value))) throw new Error(`[theme] ${path} is "${String(value)}"; use one of ${allowed.join(", ")}`)
  }
  const colors = deriveColors(isGroup(merged.colors) ? merged.colors : {})
  const mode = merged.mode ?? (luminance(paint(colors.background)) < DARK_LUMINANCE ? "dark" : "light")
  return { ...merged, mode, colors } as Theme
}

const requested = new URLSearchParams(location.search).get("theme")
const source: string | ThemeFile = requested ?? (config.theme as string | ThemeFile)

export const themeName = typeof source === "string" ? source : "video.config.json"
export const theme = validate(load(source))

const cssVar = (key: string) => `--color-${key.replace(/[A-Z0-9]/g, (ch) => `-${ch.toLowerCase()}`)}`

/** Puts the theme on :root, where Tailwind's colour classes (bg-surface, text-muted, …) and the fonts read it. */
export function applyTheme() {
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(theme.colors)) root.setProperty(cssVar(key), value)
  root.setProperty("--font-display", theme.fonts.display)
  root.setProperty("--font-sans", theme.fonts.body)
  root.setProperty("--font-mono", theme.fonts.mono)
}

const firstFamily = (stack: string) => stack.split(",")[0].trim().replace(/^["']|["']$/g, "")
const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "cursive"])

/** Warns, in the console that still.mjs prints, about text that won't read and fonts that won't load. */
export function checkTheme() {
  const c = theme.colors
  const grounds = [...new Set([c.background, c.background2])].map((g) => ({ name: g === c.background ? "background" : "background2", rgb: paint(g) }))
  const surface = paint(c.surface, toHex(grounds[0].rgb))
  const appBg = getComputedStyle(document.documentElement).getPropertyValue("--color-app-bg").trim() || "#ffffff"
  const pairs: Array<[string, Rgb, string, Rgb, number]> = [
    ...grounds.flatMap((g): Array<[string, Rgb, string, Rgb, number]> => [
      ["foreground", paint(c.foreground, toHex(g.rgb)), g.name, g.rgb, TEXT_CONTRAST],
      ["muted", paint(c.muted, toHex(g.rgb)), g.name, g.rgb, TEXT_CONTRAST],
    ]),
    ["foreground", paint(c.foreground, toHex(surface)), "surface", surface, TEXT_CONTRAST],
    ["muted", paint(c.muted, toHex(surface)), "surface", surface, TEXT_CONTRAST],
    ["accentForeground", paint(c.accentForeground, toHex(paint(c.accent))), "accent", paint(c.accent), TEXT_CONTRAST],
    ["success", paint(c.success, toHex(surface)), "surface", surface, MARK_CONTRAST],
    ["accent", paint(c.accent, appBg), "the product's background (--color-app-bg)", paint(appBg), MARK_CONTRAST],
  ]
  for (const [fg, a, bg, b, min] of pairs) {
    const ratio = contrast(a, b)
    if (ratio < min) console.warn(`[theme] ${fg} on ${bg} is ${ratio.toFixed(1)}:1; it needs ${min}:1`)
  }
  const loaded = new Set([...document.fonts].map((face) => face.family.replace(/^["']|["']$/g, "")))
  for (const [role, stack] of Object.entries(theme.fonts)) {
    const family = firstFamily(stack)
    if (!GENERIC.has(family) && !loaded.has(family)) console.warn(`[theme] fonts.${role} "${family}" has no @font-face; add it to src/fonts.css`)
  }
}
