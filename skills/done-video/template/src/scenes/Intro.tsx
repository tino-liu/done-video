import { Ease, enter, interp, spring } from "../lib/anim"
import { brand } from "../lib/brand"
import type { Helpers } from "../lib/timeline"
import type { SceneDef, SceneProps } from "./types"

const PRESENTER = { name: "Alex Doe", role: "Acme · Tasks team" }

function beats(h: Helpers) {
  return { hello: h.voiceStart - 4, card: h.cue("Alex") - 6 }
}

function Intro({ f, h }: SceneProps) {
  const b = beats(h)
  const words = ["Hi", "everyone"]
  const card = spring(f - b.card, { damping: 18 })
  const wave = Math.sin((f - b.hello) / 3) * 18 * interp(f, [b.hello + 6, b.hello + 60], [1, 0.25])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="flex items-center gap-6 font-bold tracking-tight text-white" style={{ fontSize: 104, marginTop: -60 }}>
        {words.map((w, i) => {
          const t = enter(f, b.hello + i * 5, 12, Ease.out)
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
      <div
        className="mt-14 flex items-center gap-8 rounded-2xl border border-white/10 py-6 pr-10 pl-8"
        style={{ background: "rgba(20,20,20,0.75)", opacity: Math.min(1, card * 1.3), transform: `translateY(${(1 - card) * 50}px)`, boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}
      >
        <span className="bg-accent block h-[92px] w-2 rounded-full" />
        <div>
          <div className="text-[46px] leading-tight font-semibold text-white">{PRESENTER.name}</div>
          <div className="text-muted mt-1 text-[26px]">{PRESENTER.role}</div>
        </div>
        <span className="mx-2 h-[92px] w-px bg-white/15" />
        <img src={brand.logo} style={{ height: 84 }} />
      </div>
    </div>
  )
}

export const intro: SceneDef = { Component: Intro }
