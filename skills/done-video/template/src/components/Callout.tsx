import type { ReactNode } from "react"

import { Ease, enter, interp } from "../lib/anim"
import { accentA } from "../lib/brand"
import { measure, useRoot } from "../lib/measure"
import { useShot } from "./Camera"

type Side = "top" | "bottom" | "left" | "right"

const RING_PAD = 7

/** An accent ring around a target, the same thickness on screen whatever the zoom. */
export function Highlight({ f, at, until = Infinity, target, pad = RING_PAD, radius = 10 }: { f: number; at: number; until?: number; target: string; pad?: number; radius?: number }) {
  const root = useRoot()?.current
  const { s } = useShot()
  const box = measure(root, target)
  const t = Math.min(enter(f, at, 8), interp(f, [until, until + 8], [1, 0]))
  if (!box || t <= 0) return null
  const pulse = 1 + 0.04 * Math.sin((f - at) / 4) * interp(f, [at, at + 30], [1, 0])
  return (
    <div
      className="pointer-events-none absolute z-[90]"
      style={{
        left: box.x - pad,
        top: box.y - pad,
        width: box.w + pad * 2,
        height: box.h + pad * 2,
        borderRadius: radius,
        border: `${3 / s}px solid var(--color-accent)`,
        boxShadow: `0 0 0 ${6 / s}px ${accentA(22)}, 0 0 ${30 / s}px ${accentA(45)}`,
        opacity: t,
        transform: `scale(${(0.96 + 0.04 * t) * pulse})`,
      }}
    />
  )
}

/** An accent label pointing at a target. Keeps its on-screen size as the camera zooms. */
export function Callout({ f, at, until = Infinity, target, side = "bottom", children, ring = true, gap = 18 }: { f: number; at: number; until?: number; target: string; side?: Side; children: ReactNode; ring?: boolean; gap?: number }) {
  const root = useRoot()?.current
  const { s } = useShot()
  const box = measure(root, target)
  const t = Math.min(enter(f, at, 12, Ease.outBack), interp(f, [until, until + 8], [1, 0]))
  if (!box || t <= 0) return null
  const g = (gap + RING_PAD) / s
  const anchor = {
    bottom: { x: box.cx, y: box.y + box.h + g, shift: "translate(-50%, 0)", arrow: "top" },
    top: { x: box.cx, y: box.y - g, shift: "translate(-50%, -100%)", arrow: "bottom" },
    right: { x: box.x + box.w + g, y: box.cy, shift: "translate(0, -50%)", arrow: "left" },
    left: { x: box.x - g, y: box.cy, shift: "translate(-100%, -50%)", arrow: "right" },
  }[side]
  const arrowStyle = {
    top: { left: "50%", top: -8, transform: "translateX(-50%) rotate(45deg)" },
    bottom: { left: "50%", bottom: -8, transform: "translateX(-50%) rotate(45deg)" },
    left: { top: "50%", left: -8, transform: "translateY(-50%) rotate(45deg)" },
    right: { top: "50%", right: -8, transform: "translateY(-50%) rotate(45deg)" },
  }[anchor.arrow]
  return (
    <>
      {ring && <Highlight f={f} at={at} until={until} target={target} />}
      <div className="pointer-events-none absolute z-[95]" style={{ left: anchor.x, top: anchor.y, transform: `scale(${1 / s})`, transformOrigin: "0 0" }}>
        <div style={{ transform: anchor.shift }}>
          <div
            className="bg-accent relative rounded-xl font-sans font-semibold whitespace-nowrap text-white"
            style={{ padding: "11px 20px", fontSize: 22, boxShadow: "0 12px 30px rgba(0,0,0,0.35)", opacity: Math.min(1, t), transform: `scale(${0.85 + 0.15 * t})` }}
          >
            <span className="bg-accent absolute block size-4" style={arrowStyle} />
            <span className="relative flex items-center gap-2">{children}</span>
          </div>
        </div>
      </div>
    </>
  )
}
