import { Lock } from "lucide-react"
import type { ReactNode } from "react"

import { WINDOW_BOX } from "./Camera"

export const TITLE_BAR = 46

type Props = {
  url: string
  theme?: "dark" | "light"
  children: ReactNode
  /** Extra content drawn over the page, e.g. Chrome's "sharing your screen" bar. */
  overlay?: ReactNode
}

/** A browser window floating on the backdrop, at the same place in every scene. */
export function BrowserWindow({ url, theme = "dark", children, overlay }: Props) {
  const dark = theme === "dark"
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: WINDOW_BOX.x,
        top: WINDOW_BOX.y,
        width: WINDOW_BOX.w,
        height: WINDOW_BOX.h,
        borderRadius: 14,
        boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.09)",
      }}
    >
      <div className="relative flex items-center px-5" style={{ height: TITLE_BAR, background: dark ? "#1d1d20" : "#e8e8ea" }}>
        <div className="flex gap-2">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="block rounded-full" style={{ width: 13, height: 13, background: c }} />
          ))}
        </div>
        <div
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4"
          style={{ height: 30, width: 620, background: dark ? "#2a2a2e" : "#ffffff", color: dark ? "#d4d4d8" : "#3c3c43", fontSize: 15 }}
        >
          <Lock size={13} strokeWidth={2.4} className="opacity-70" />
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative overflow-hidden" style={{ height: WINDOW_BOX.h - TITLE_BAR, background: dark ? "#101012" : "#ffffff" }}>
        {children}
      </div>
      {overlay}
    </div>
  )
}
