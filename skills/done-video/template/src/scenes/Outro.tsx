import { CircleCheck } from "lucide-react"

import { enter, interp, spring } from "../lib/anim"
import { brand } from "../lib/brand"
import type { Helpers } from "../lib/timeline"
import type { SceneDef, SceneProps } from "./types"

const DONE = "PBI #123 · Export tasks to CSV"
const PRESENTER = "Alex"

function beats(h: Helpers) {
  return { done: h.cue("done") - 4, review: h.cue("review") - 2, signoff: h.cue(PRESENTER) - 4, fade: h.dur - 22 }
}

function Outro({ f, h }: SceneProps) {
  const b = beats(h)
  const card = spring(f - b.done, { damping: 16 })
  const check = spring(f - b.done - 8, { damping: 10 })
  const fade = interp(f, [b.fade, h.dur], [0, 1])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="flex items-center gap-6 rounded-2xl border border-white/10 px-10 py-7" style={{ background: "rgba(20,20,20,0.75)", opacity: Math.min(1, card * 1.3), transform: `translateY(${(1 - card) * 40}px)` }}>
        <CircleCheck size={64} className="text-green-400" style={{ transform: `scale(${check})` }} />
        <div>
          <div className="text-[44px] font-semibold text-white">{DONE}</div>
          <div className="text-muted mt-1 text-[26px]" style={{ opacity: enter(f, b.review, 10) }}>
            Done · ready for review
          </div>
        </div>
      </div>
      <div className="mt-12 flex items-center gap-4" style={{ opacity: enter(f, b.review + 6, 14) }}>
        <img src={brand.logo} style={{ height: 56 }} />
        <span className="text-[40px] font-semibold tracking-tight text-white">{brand.name}</span>
      </div>
      <div className="mt-9 flex items-center gap-3 text-[30px] font-medium text-white" style={{ opacity: enter(f, b.signoff, 12), transform: `translateY(${(1 - enter(f, b.signoff, 12)) * 14}px)` }}>
        <span className="inline-block" style={{ transform: `rotate(${Math.sin((f - b.signoff) / 3) * 16 * interp(f, [b.signoff, b.signoff + 45], [1, 0])}deg)`, transformOrigin: "70% 80%" }}>
          👋
        </span>
        {PRESENTER}, signing off
      </div>
      <div className="absolute inset-0 bg-black" style={{ opacity: fade }} />
    </div>
  )
}

export const outro: SceneDef = { Component: Outro, events: (h) => [{ at: beats(h).done + 8, type: "chime" }] }
