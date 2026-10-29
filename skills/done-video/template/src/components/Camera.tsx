import { createContext, useContext, useRef } from "react"
import type { ReactNode } from "react"

import { Ease, interp } from "../lib/anim"
import { measure, RootContext } from "../lib/measure"
import stage from "../stage.json"

export const STAGE_W = stage.width
export const STAGE_H = stage.height

/** Where the browser window sits on the stage. The camera keeps zoomed shots inside it. */
export const WINDOW_BOX = stage.window

/** ?home holds every shot at home, so still.mjs --compare finds the window's contents at their real size. */
const HOLD_HOME = new URLSearchParams(location.search).has("home")

export type CamKey = {
  /** Frame the move starts. */
  at: number
  /** Frames the move takes. */
  dur?: number
  /** A data-t target to centre on. */
  target?: string
  x?: number
  y?: number
  /** Zoom. When omitted with a target, zooms to fit the target with `pad` around it. */
  scale?: number
  pad?: number
  maxScale?: number
  /** Nudges the focus point after resolving the target. */
  dx?: number
  dy?: number
}

export type Shot = { cx: number; cy: number; s: number }

export const HOME: Shot = { cx: STAGE_W / 2, cy: STAGE_H / 2, s: 1 }
const DEFAULT_MOVE = 26
const DEFAULT_PAD = 60
const DEFAULT_MAX_SCALE = 2.2
/** Below this zoom the focus blends from the stage centre to the window centre. */
const BLEND_UNTIL = 1.16

function clampShot({ cx, cy, s }: Shot): Shot {
  const { x, y, w, h } = WINDOW_BOX
  const clampAxis = (v: number, min: number, max: number, half: number) => {
    const a = min + half / s
    const b = max - half / s
    return a <= b ? Math.min(b, Math.max(a, v)) : (min + max) / 2
  }
  const inside = { cx: clampAxis(cx, x, x + w, STAGE_W / 2), cy: clampAxis(cy, y, y + h, STAGE_H / 2) }
  // At zoom 1 the shot is the whole stage; by BLEND_UNTIL it is held inside the window.
  const t = Math.min(1, Math.max(0, (s - 1) / (BLEND_UNTIL - 1)))
  return { cx: HOME.cx + (inside.cx - HOME.cx) * t, cy: HOME.cy + (inside.cy - HOME.cy) * t, s }
}

function resolve(root: HTMLElement | null, key: CamKey, prev: Shot): Shot {
  let { cx, cy, s } = prev
  if (key.target) {
    const box = measure(root, key.target)
    if (box) {
      cx = box.cx
      cy = box.cy
      const pad = key.pad ?? DEFAULT_PAD
      s = key.scale ?? Math.min(STAGE_W / (box.w + pad * 2), STAGE_H / (box.h + pad * 2), key.maxScale ?? DEFAULT_MAX_SCALE)
    }
  }
  if (key.x !== undefined) cx = key.x
  if (key.y !== undefined) cy = key.y
  if (key.scale !== undefined) s = key.scale
  cx += key.dx ?? 0
  cy += key.dy ?? 0
  return clampShot({ cx, cy, s: Math.max(1, s) })
}

/** The shot at frame f. */
function shotAt(root: HTMLElement | null, f: number, camKeys: CamKey[]): Shot {
  let from = HOME
  for (const key of camKeys) {
    const to = resolve(root, key, from)
    const end = key.at + (key.dur ?? DEFAULT_MOVE)
    if (f < key.at) return from
    if (f < end) {
      const t = interp(f, [key.at, end], [0, 1], Ease.inOut)
      // Zoom in log space so in and out feel the same speed.
      const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * t)
      return { cx: from.cx + (to.cx - from.cx) * t, cy: from.cy + (to.cy - from.cy) * t, s }
    }
    from = to
  }
  return from
}

const ShotContext = createContext<Shot>({ cx: STAGE_W / 2, cy: STAGE_H / 2, s: 1 })

/** The camera's current shot, so overlays inside it can keep a constant on-screen size. */
export const useShot = () => useContext(ShotContext)

/** Zooms and pans its children. Children measure their targets against this element. */
export function Camera({ f, keys: camKeys = [], children }: { f: number; keys?: CamKey[]; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const { cx, cy, s } = HOLD_HOME ? HOME : shotAt(root.current, f, camKeys)
  const tx = STAGE_W / 2 - cx * s
  const ty = STAGE_H / 2 - cy * s
  return (
    <RootContext.Provider value={root}>
      <ShotContext.Provider value={{ cx, cy, s }}>
      <div
        ref={root}
        className="absolute inset-0"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: "0 0" }}
      >
        {children}
      </div>
      </ShotContext.Provider>
    </RootContext.Provider>
  )
}
