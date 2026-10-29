// Cursor and camera targets are real DOM elements tagged with data-t="name". Positions are read from
// the offset chain, which ignores CSS transforms, so the camera can zoom and dialogs can animate in
// without moving the targets. Ancestors that fake scrolling with a transform declare it with
// data-tx / data-ty so it can be added back.
import { createContext, useContext } from "react"
import type { RefObject } from "react"

export type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number }

export const RootContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const useRoot = () => useContext(RootContext)

export function measure(root: HTMLElement | null | undefined, target: string): Box | null {
  if (!root) return null
  const el = root.querySelector<HTMLElement>(`[data-t="${target}"]`)
  if (!el) return null
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== root) {
    x += node.offsetLeft + Number(node.dataset.tx ?? 0)
    y += node.offsetTop + Number(node.dataset.ty ?? 0)
    node = node.offsetParent as HTMLElement | null
  }
  const w = el.offsetWidth
  const h = el.offsetHeight
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}
