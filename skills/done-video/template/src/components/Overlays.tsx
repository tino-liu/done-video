import { Mic } from "lucide-react"
import type { CSSProperties } from "react"

import { Ease, interp } from "../lib/anim"
import { brand } from "../lib/brand"
import { accentA, glowA, label, radius, surface, theme } from "../lib/style"
import { FPS, timeline } from "../lib/timeline"
import type { SceneTiming, Word } from "../lib/timeline"

const INK = (percent: number) => `color-mix(in srgb, var(--color-foreground) ${percent}%, transparent)`
const NOISE = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`
const FADE_EDGES = "radial-gradient(ellipse at center, black 30%, transparent 80%)"

const TEXTURES: Record<Exclude<typeof theme.backdrop.texture, "none">, CSSProperties> = {
  dots: { backgroundImage: `radial-gradient(${INK(7)} 1px, transparent 1px)`, backgroundSize: "34px 34px", maskImage: FADE_EDGES },
  grid: { backgroundImage: `linear-gradient(${INK(6)} 1px, transparent 1px), linear-gradient(90deg, ${INK(6)} 1px, transparent 1px)`, backgroundSize: "64px 64px", maskImage: FADE_EDGES },
  noise: { backgroundImage: NOISE, opacity: theme.mode === "dark" ? 0.06 : 0.1, mixBlendMode: theme.mode === "dark" ? "screen" : "multiply" },
}

/** The theme's backdrop: a flat colour, a gradient, an image, or the gradient with two slow glows in the brand colours. */
export function Backdrop({ g }: { g: number }) {
  const { style, texture, image, dim } = theme.backdrop
  const drift = Math.sin(g / 240) * 6
  return (
    <div className="absolute inset-0" style={{ background: style === "solid" ? "var(--color-background)" : "linear-gradient(180deg, var(--color-background-2) 0%, var(--color-background) 100%)" }}>
      {style === "image" && image && (
        <>
          <img src={image} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0" style={{ background: "var(--color-background)", opacity: dim }} />
        </>
      )}
      {style === "aurora" && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(900px 620px at ${12 + drift}% ${92 - drift}%, ${accentA(38)}, transparent 70%), radial-gradient(800px 560px at ${88 - drift}% ${8 + drift}%, ${glowA(22)}, transparent 70%)`,
          }}
        />
      )}
      {texture !== "none" && <div className="absolute inset-0" style={TEXTURES[texture]} />}
    </div>
  )
}

/** Each scene's `chapter` from scripts/scenes.mjs, numbered in the order the chapters first appear. */
const CHAPTER_NUMBERS = new Map<string, number>()
for (const s of timeline.scenes) if (s.chapter && !CHAPTER_NUMBERS.has(s.chapter)) CHAPTER_NUMBERS.set(s.chapter, CHAPTER_NUMBERS.size + 1)

const chapterOf = (s?: SceneTiming) => (s?.chapter ? { n: CHAPTER_NUMBERS.get(s.chapter) ?? 0, title: s.chapter } : undefined)

/** "Step 1 of 3 · Export to CSV" pill, top left, plus the brand lockup top right. */
export function ChapterHeader({ scene, local, prev }: { scene: SceneTiming; local: number; prev?: SceneTiming }) {
  const chapter = chapterOf(scene)
  const prevChapter = chapterOf(prev)
  const isNew = chapter && chapter.n !== prevChapter?.n
  const show = chapter ? (isNew && !prevChapter ? interp(local, [6, 20]) : 1) : prevChapter ? interp(local, [0, 10], [1, 0]) : 0
  const shown = chapter ?? prevChapter
  if (!shown || show <= 0) return null
  const swap = isNew && prevChapter ? interp(local, [4, 18], [0, 1], Ease.out) : 1
  return (
    <>
      <div className="absolute flex items-center gap-4" style={{ left: 120, top: 30, opacity: show }}>
        <div className="flex items-center gap-3 py-2 pr-6 pl-2" style={surface("chip")}>
          <span className="bg-accent text-accent-foreground flex items-center justify-center font-bold" style={{ width: 34, height: 34, fontSize: 17, borderRadius: radius.chip }}>
            {shown.n}
          </span>
          <span className="text-muted" style={{ ...label, fontSize: 15 }}>
            Step {shown.n} of {CHAPTER_NUMBERS.size}
          </span>
          <span style={{ width: theme.shape.border, height: 18, background: "var(--color-border)" }} />
          <span className="text-foreground" style={{ fontSize: 20, fontWeight: 600, opacity: swap, transform: `translateY(${(1 - swap) * 8}px)`, display: "inline-block" }}>{shown.title}</span>
        </div>
      </div>
      <div className="absolute flex items-center gap-3 px-5 py-2.5" style={{ right: 120, top: 30, opacity: show, ...surface("chip") }}>
        <img src={brand.logo} style={{ height: 24 }} />
        <span className="text-foreground" style={{ fontSize: 20, fontWeight: 600 }}>
          {brand.name}
        </span>
      </div>
    </>
  )
}

const MAX_WORDS = 9
const CAPTION_HOLD = 0.35
const CAPTION_BOTTOM = 64

/** Splits the line into caption chunks at sentence and clause ends, at most MAX_WORDS each. */
function chunks(words: Word[]) {
  const out: Word[][] = []
  let cur: Word[] = []
  for (const w of words) {
    cur.push(w)
    if (/[.?!]$/.test(w.w) || (/[,:;]$/.test(w.w) && cur.length >= 4) || cur.length >= MAX_WORDS) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out
}

export function Captions({ scene, local }: { scene: SceneTiming; local: number }) {
  if (!scene.captions) return null
  const t = (local - scene.lead) / FPS
  const list = chunks(scene.words)
  const i = list.findIndex((c, k) => t >= c[0].s - 0.05 && t < (list[k + 1] ? list[k + 1][0].s - 0.05 : c[c.length - 1].e + CAPTION_HOLD))
  if (i < 0) return null
  const chunk = list[i]
  const text = chunk.map((w) => w.w).join(" ")
  const fadeIn = interp(t, [chunk[0].s - 0.05, chunk[0].s + 0.1])
  return (
    <div className="absolute flex justify-center" style={{ left: 0, right: 0, bottom: scene.captionBottom ?? CAPTION_BOTTOM }}>
      <div className="text-foreground flex items-center gap-3" style={{ ...surface("box"), padding: "12px 26px", fontSize: 30, fontWeight: 500, opacity: fadeIn, maxWidth: 1400 }}>
        {scene.recording && (
          <span className="bg-accent text-accent-foreground flex items-center gap-2" style={{ padding: "4px 12px", fontSize: 18, fontWeight: 600, borderRadius: radius.chip }}>
            <Mic size={16} /> In the recording
          </span>
        )}
        <span style={{ fontStyle: scene.recording ? "italic" : "normal" }}>{text}</span>
      </div>
    </div>
  )
}
