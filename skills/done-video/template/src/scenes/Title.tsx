import { FileSpreadsheet } from "lucide-react"

import { Ease, enter, interp, spring } from "../lib/anim"
import { brand } from "../lib/brand"
import type { SceneDef, SceneProps } from "./types"

const PBI = "PBI #123"
const HEADLINE = "Export tasks to CSV"
const TAGLINE = "Every task, its owner and its due date, in one click."

function Title({ f, h }: SceneProps) {
  const pill = enter(f, 4, 10, Ease.outBack)
  const logo = spring(f - 8, { damping: 16 })
  const head = spring(f - 14, { damping: 16 })
  const line = interp(f, [20, 44], [0, 1], Ease.out)
  const out = interp(f, [h.dur - 10, h.dur], [1, 0.9])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: `scale(${out})` }}>
      <div className="bg-accent mb-10 rounded-full px-5 py-2 text-[20px] font-semibold tracking-[0.2em] text-white" style={{ opacity: pill, transform: `scale(${0.8 + 0.2 * pill})` }}>
        {PBI} · DONE
      </div>
      <div className="flex items-center gap-10">
        <img src={brand.logo} style={{ height: 92, opacity: logo, transform: `translateX(${(1 - logo) * -60}px)` }} />
        <div className="flex items-center gap-5 text-white" style={{ opacity: head, transform: `translateX(${(1 - head) * 60}px)` }}>
          <FileSpreadsheet size={80} strokeWidth={1.6} />
          <span className="text-[88px] font-semibold tracking-tight">{HEADLINE}</span>
        </div>
      </div>
      <div className="mt-10 h-1 rounded-full bg-gradient-to-r from-transparent via-(--color-accent) to-transparent" style={{ width: 1100 * line }} />
      <div className="text-muted mt-8 text-[30px]" style={{ opacity: enter(f, 30, 12) }}>
        {TAGLINE}
      </div>
    </div>
  )
}

export const title: SceneDef = { Component: Title, events: () => [{ at: 14, type: "chime" }] }
