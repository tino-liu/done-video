import { Mic } from "lucide-react"

import { Ease, interp } from "../lib/anim"
import { accentA, brand, glowA } from "../lib/brand"
import { FPS, timeline } from "../lib/timeline"
import type { SceneTiming, Word } from "../lib/timeline"

/** Dark backdrop with two slow glows in the brand colours. */
export function Backdrop({ g }: { g: number }) {
  const drift = Math.sin(g / 240) * 6
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #333333 0%, #222222 55%, #1b1b1b 100%)" }}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(900px 620px at ${12 + drift}% ${92 - drift}%, ${accentA(38)}, transparent 70%), radial-gradient(800px 560px at ${88 - drift}% ${8 + drift}%, ${glowA(22)}, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "34px 34px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)" }}
      />
    </div>
  )
}

/** Each scene's `chapter` from scripts/scenes.mjs, numbered in the order the chapters first appear. */
const CHAPTER_NUMBERS = new Map<string, number>()
for (const s of timeline.scenes) if (s.chapter && !CHAPTER_NUMBERS.has(s.chapter)) CHAPTER_NUMBERS.set(s.chapter, CHAPTER_NUMBERS.size + 1)

const chapterOf = (s?: SceneTiming) => (s?.chapter ? { n: CHAPTER_NUMBERS.get(s.chapter) ?? 0, title: s.chapter } : undefined)

const PILL = { background: "rgba(20,20,20,0.72)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }

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
        <div className="flex items-center gap-3 rounded-full py-2 pr-6 pl-2" style={PILL}>
          <span className="bg-accent flex items-center justify-center rounded-full font-bold text-white" style={{ width: 34, height: 34, fontSize: 17 }}>
            {shown.n}
          </span>
          <span className="text-muted" style={{ fontSize: 15, letterSpacing: "0.12em", fontWeight: 600 }}>
            STEP {shown.n} OF {CHAPTER_NUMBERS.size}
          </span>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)" }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: "#fff", opacity: swap, transform: `translateY(${(1 - swap) * 8}px)`, display: "inline-block" }}>{shown.title}</span>
        </div>
      </div>
      <div className="absolute flex items-center gap-3 rounded-full px-5 py-2.5" style={{ right: 120, top: 30, opacity: show, ...PILL }}>
        <img src={brand.logo} style={{ height: 24 }} />
        <span className="text-white" style={{ fontSize: 20, fontWeight: 600 }}>
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
      <div
        className="flex items-center gap-3 rounded-xl"
        style={{ background: "rgba(12,12,12,0.82)", padding: "12px 26px", fontSize: 30, fontWeight: 500, color: "#fff", opacity: fadeIn, backdropFilter: "blur(6px)", maxWidth: 1400, border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {scene.recording && (
          <span className="bg-accent flex items-center gap-2 rounded-full" style={{ padding: "4px 12px", fontSize: 18, fontWeight: 600 }}>
            <Mic size={16} /> In the recording
          </span>
        )}
        <span style={{ fontStyle: scene.recording ? "italic" : "normal" }}>{text}</span>
      </div>
    </div>
  )
}
