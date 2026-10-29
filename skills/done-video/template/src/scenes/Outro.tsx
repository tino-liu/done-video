import { CircleCheck } from "lucide-react"

import { interp } from "../lib/anim"
import { brand } from "../lib/brand"
import { align, appear, display, settle, surface } from "../lib/style"
import type { Helpers } from "../lib/timeline"
import type { SceneDef, SceneProps } from "./types"

const DONE = "PBI #123 · Export tasks to CSV"
const PRESENTER = "Alex"

function beats(h: Helpers) {
  return { done: h.cue("done") - 4, review: h.cue("review") - 2, signoff: h.cue(PRESENTER) - 4, fade: h.dur - 22 }
}

function Outro({ f, h }: SceneProps) {
  const b = beats(h)
  const card = settle(f, b.done)
  const check = settle(f, b.done + 8)
  const signoff = appear(f, b.signoff, 12)
  const fade = interp(f, [b.fade, h.dur], [0, 1])
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${align.className}`} style={align.style}>
      <div className="flex items-center gap-6 px-10 py-7 text-left" style={{ ...surface("card"), opacity: Math.min(1, card * 1.3), transform: `translateY(${(1 - card) * 40}px)` }}>
        <CircleCheck size={64} className="text-success" style={{ transform: `scale(${check})` }} />
        <div>
          <div className="text-foreground text-[44px]" style={display}>
            {DONE}
          </div>
          <div className="text-muted mt-1 text-[26px]" style={{ opacity: appear(f, b.review, 10) }}>
            Done · ready for review
          </div>
        </div>
      </div>
      <div className="mt-12 flex items-center gap-4" style={{ opacity: appear(f, b.review + 6, 14) }}>
        <img src={brand.logo} style={{ height: 56 }} />
        <span className="text-foreground text-[40px]" style={display}>
          {brand.name}
        </span>
      </div>
      <div className="text-foreground mt-9 flex items-center gap-3 text-[30px] font-medium" style={{ opacity: signoff, transform: `translateY(${(1 - signoff) * 14}px)` }}>
        <span className="inline-block" style={{ transform: `rotate(${Math.sin((f - b.signoff) / 3) * 16 * interp(f, [b.signoff, b.signoff + 45], [1, 0])}deg)`, transformOrigin: "70% 80%" }}>
          👋
        </span>
        {PRESENTER}, signing off
      </div>
      <div className="absolute inset-0" style={{ background: "var(--color-background)", opacity: fade }} />
    </div>
  )
}

export const outro: SceneDef = { Component: Outro, events: (h) => [{ at: beats(h).done + 8, type: "chime" }] }
