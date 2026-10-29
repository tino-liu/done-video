import type { ReactNode } from "react"

import { enter, interp } from "../lib/anim"
import { accentA, pop, radius as corners, shadow, theme } from "../lib/style"
import { measure, useRoot } from "../lib/measure"
import { useShot } from "./Camera"

type Side = "top" | "bottom" | "left" | "right"

const RING_PAD = 7
/** A ring hugs a control, so it is never rounder than this, and is square in a square theme. */
const RING_MAX_RADIUS = 10
const ARROW = 16

/** The arrow is a square turned 45°; its two outer edges carry the callout's border. */
const ARROW_EDGES: Record<Side, [string, string]> = { top: ["borderTop", "borderLeft"], bottom: ["borderBottom", "borderRight"], left: ["borderBottom", "borderLeft"], right: ["borderTop", "borderRight"] }

/** An accent ring around a target, the same thickness on screen whatever the zoom. */
export function Highlight({ f, at, until = Infinity, target, pad = RING_PAD, radius = Math.min(corners.box, RING_MAX_RADIUS) }: { f: number; at: number; until?: number; target: string; pad?: number; radius?: number }) {
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
        // A soft theme gets a halo and a glow, a hard one just the halo, and a flat one the bare ring.
        boxShadow: { soft: `0 0 0 ${6 / s}px ${accentA(22)}, 0 0 ${30 / s}px ${accentA(45)}`, hard: `0 0 0 ${6 / s}px ${accentA(22)}`, none: "none" }[theme.shadow],
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
  const t = Math.min(pop(f, at, 12), interp(f, [until, until + 8], [1, 0]))
  if (!box || t <= 0) return null
  const g = (gap + RING_PAD) / s
  const anchor = {
    bottom: { x: box.cx, y: box.y + box.h + g, shift: "translate(-50%, 0)", arrow: "top" },
    top: { x: box.cx, y: box.y - g, shift: "translate(-50%, -100%)", arrow: "bottom" },
    right: { x: box.x + box.w + g, y: box.cy, shift: "translate(0, -50%)", arrow: "left" },
    left: { x: box.x - g, y: box.cy, shift: "translate(-100%, -50%)", arrow: "right" },
  }[side]
  const arrowSide = anchor.arrow as Side
  const edge = `${theme.shape.border}px solid var(--color-border)`
  const arrowStyle = {
    ...{
      top: { left: "50%", top: -ARROW / 2, transform: "translateX(-50%) rotate(45deg)" },
      bottom: { left: "50%", bottom: -ARROW / 2, transform: "translateX(-50%) rotate(45deg)" },
      left: { top: "50%", left: -ARROW / 2, transform: "translateY(-50%) rotate(45deg)" },
      right: { top: "50%", right: -ARROW / 2, transform: "translateY(-50%) rotate(45deg)" },
    }[arrowSide],
    width: ARROW,
    height: ARROW,
    [ARROW_EDGES[arrowSide][0]]: edge,
    [ARROW_EDGES[arrowSide][1]]: edge,
  }
  return (
    <>
      {ring && <Highlight f={f} at={at} until={until} target={target} />}
      <div className="pointer-events-none absolute z-[95]" style={{ left: anchor.x, top: anchor.y, transform: `scale(${1 / s})`, transformOrigin: "0 0" }}>
        <div style={{ transform: anchor.shift }}>
          <div
            className="bg-accent text-accent-foreground relative font-sans font-semibold whitespace-nowrap"
            style={{ padding: "11px 20px", fontSize: 22, border: edge, borderRadius: corners.box, boxShadow: shadow("small"), opacity: Math.min(1, t), transform: `scale(${0.85 + 0.15 * t})` }}
          >
            <span className="bg-accent absolute block" style={arrowStyle} />
            <span className="relative flex items-center gap-2">{children}</span>
          </div>
        </div>
      </div>
    </>
  )
}
