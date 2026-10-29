import { Ease, interp, keys } from "../lib/anim"
import { accentA } from "../lib/style"
import { measure, useRoot } from "../lib/measure"
import { useShot } from "./Camera"

export type CursorKey = {
  /** Frame the cursor arrives (and clicks, when click is set). */
  at: number
  target?: string
  x?: number
  y?: number
  /** Offset from the target's centre. */
  dx?: number
  dy?: number
  click?: boolean
  /** Frames the move takes. */
  dur?: number
}

const DEFAULT_MOVE = 20
const PRESS_FRAMES = 7
const RIPPLE_FRAMES = 16
const RIPPLE_RADIUS = 30

type Point = { x: number; y: number }

/** Frames on which the cursor clicks, for the click sound. */
export const clickFrames = (cursorKeys: CursorKey[]) => cursorKeys.filter((k) => k.click).map((k) => k.at)

/** True from the click on `at` onwards; lets a button show its pressed or loading state. */
export const after = (f: number, at: number) => f >= at

/** Pressed look for a button clicked at `at`. */
export const pressed = (f: number, at: number) => f >= at && f < at + PRESS_FRAMES

export function Cursor({ f, keys: cursorKeys, start = { x: 1500, y: 900 }, hideAfter }: { f: number; keys: CursorKey[]; start?: Point; hideAfter?: number }) {
  const root = useRoot()?.current ?? null
  // Grows a little with the zoom, not fully, so a 2x shot doesn't get a giant pointer.
  const counter = 1 / Math.pow(useShot().s, 0.6)

  const resolve = (k: CursorKey, prev: Point): Point => {
    let p = prev
    if (k.target) {
      const box = measure(root, k.target)
      if (box) p = { x: box.cx, y: box.cy }
    }
    if (k.x !== undefined || k.y !== undefined) p = { x: k.x ?? p.x, y: k.y ?? p.y }
    return { x: p.x + (k.dx ?? 0), y: p.y + (k.dy ?? 0) }
  }

  let pos = start
  let lastClick = -Infinity
  let prevAt = -Infinity
  for (const k of cursorKeys) {
    const to = resolve(k, pos)
    const moveStart = Math.max(prevAt, k.at - (k.dur ?? DEFAULT_MOVE))
    if (f < moveStart) break
    if (f < k.at) {
      const t = interp(f, [moveStart, k.at], [0, 1], Ease.inOut)
      pos = { x: pos.x + (to.x - pos.x) * t, y: pos.y + (to.y - pos.y) * t }
      break
    }
    pos = to
    if (k.click) lastClick = k.at
    prevAt = k.at
  }

  const first = cursorKeys[0]
  const appear = first ? first.at - (first.dur ?? DEFAULT_MOVE) - 6 : 0
  const opacity = hideAfter !== undefined ? Math.min(interp(f, [appear, appear + 6]), interp(f, [hideAfter, hideAfter + 8], [1, 0])) : interp(f, [appear, appear + 6])
  const press = keys(f - lastClick, [
    [0, 1],
    [3, 0.82],
    [PRESS_FRAMES, 1],
  ])
  const rippleT = (f - lastClick) / RIPPLE_FRAMES
  const showRipple = rippleT >= 0 && rippleT <= 1

  return (
    <div className="pointer-events-none absolute top-0 left-0 z-[100]" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${counter})`, transformOrigin: "0 0", opacity }}>
      {showRipple && (
        <div
          className="absolute rounded-full"
          style={{
            width: RIPPLE_RADIUS * 2,
            height: RIPPLE_RADIUS * 2,
            left: -RIPPLE_RADIUS,
            top: -RIPPLE_RADIUS,
            background: accentA(35),
            border: `2px solid ${accentA(80)}`,
            transform: `scale(${Ease.out(rippleT)})`,
            opacity: 1 - rippleT,
          }}
        />
      )}
      <svg width="30" height="42" viewBox="0 0 20 28" style={{ transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))" }}>
        <path d="M1.5 1.5 L1.5 22 L6.5 17.2 L10 25.5 L13.6 24 L10.2 15.8 L17 15.8 Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
