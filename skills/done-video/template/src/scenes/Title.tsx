import { FileSpreadsheet } from "lucide-react"

import { interp } from "../lib/anim"
import { brand } from "../lib/brand"
import { align, appear, display, label, pop, radius, settle, theme } from "../lib/style"
import type { SceneDef, SceneProps } from "./types"

const PBI = "PBI #123"
const HEADLINE = "Export tasks to CSV"
const TAGLINE = "Every task, its owner and its due date, in one click."

function Title({ f, h }: SceneProps) {
  const pill = pop(f, 4, 10)
  const logo = settle(f, 8)
  const head = settle(f, 14)
  const line = appear(f, 20, 24)
  const out = interp(f, [h.dur - 10, h.dur], [1, 0.9])
  const start = theme.align === "start"
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${align.className}`} style={{ ...align.style, transform: `scale(${out})` }}>
      <div
        className="bg-accent text-accent-foreground mb-10 px-5 py-2 text-[20px]"
        style={{ ...label, borderRadius: radius.chip, opacity: pill, transform: `scale(${0.8 + 0.2 * pill})`, transformOrigin: start ? "left center" : "center" }}
      >
        {PBI} · Done
      </div>
      <div className="flex items-center gap-10">
        <img src={brand.logo} style={{ height: 92, opacity: logo, transform: `translateX(${(1 - logo) * -60}px)` }} />
        <div className="text-foreground flex items-center gap-5" style={{ opacity: head, transform: `translateX(${(1 - head) * 60}px)` }}>
          <FileSpreadsheet size={80} strokeWidth={1.6} />
          <span className="text-[88px]" style={display}>
            {HEADLINE}
          </span>
        </div>
      </div>
      <div
        className={`mt-10 h-1 bg-gradient-to-r ${start ? "from-(--color-accent) to-transparent" : "from-transparent via-(--color-accent) to-transparent"}`}
        style={{ width: 1100 * line, borderRadius: radius.card }}
      />
      <div className="text-muted mt-8 text-[30px]" style={{ opacity: appear(f, 30, 12) }}>
        {TAGLINE}
      </div>
    </div>
  )
}

export const title: SceneDef = { Component: Title, events: () => [{ at: 14, type: "chime" }] }
