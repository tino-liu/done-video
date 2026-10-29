import { enter, interp, spring } from "../lib/anim"
import { brand } from "../lib/brand"
import { align, appear, display, radius, settle, surface, theme } from "../lib/style"
import type { Helpers } from "../lib/timeline"
import type { SceneDef, SceneProps } from "./types"

const PRESENTER = { name: "Alex Doe", role: "Acme · Tasks team" }

function beats(h: Helpers) {
  return { hello: h.voiceStart - 4, card: h.cue("Alex") - 6 }
}

function Intro({ f, h }: SceneProps) {
  const b = beats(h)
  const words = ["Hi", "everyone"]
  const card = settle(f, b.card)
  const wave = Math.sin((f - b.hello) / 3) * 18 * interp(f, [b.hello + 6, b.hello + 60], [1, 0.25])
  return (
    <div className={`absolute inset-0 flex flex-col justify-center ${align.className}`} style={align.style}>
      <div className="text-foreground flex items-center gap-6" style={{ ...display, fontSize: 104, marginTop: -60 }}>
        {words.map((w, i) => {
          const t = appear(f, b.hello + i * 5, 12)
          return (
            <span key={w} className="inline-block" style={{ opacity: t, transform: `translateY(${(1 - t) * 36}px)` }}>
              {w}
            </span>
          )
        })}
        <span className="inline-block" style={{ opacity: enter(f, b.hello + 12, 10), transform: `rotate(${wave}deg) scale(${0.6 + 0.4 * spring(f - b.hello - 12, { damping: 12 })})`, transformOrigin: "70% 80%" }}>
          👋
        </span>
      </div>
      <div className="mt-14 flex items-center gap-8 py-6 pr-10 pl-8 text-left" style={{ ...surface("card"), opacity: Math.min(1, card * 1.3), transform: `translateY(${(1 - card) * 50}px)` }}>
        <span className="bg-accent block h-[92px] w-2" style={{ borderRadius: radius.card }} />
        <div>
          <div className="text-foreground text-[46px] leading-tight" style={display}>
            {PRESENTER.name}
          </div>
          <div className="text-muted mt-1 text-[26px]">{PRESENTER.role}</div>
        </div>
        <span className="mx-2 block h-[92px]" style={{ width: theme.shape.border, background: "var(--color-border)" }} />
        <img src={brand.logo} style={{ height: 84 }} />
      </div>
    </div>
  )
}

export const intro: SceneDef = { Component: Intro }
