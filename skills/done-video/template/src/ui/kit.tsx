// Frame-driven UI primitives for the product mockups. Each one takes the frame (or a state derived
// from it) instead of holding state, so any frame renders on its own. They are styled with the
// example app's tokens (--color-app-* in styles.css); restyle them to match the real product.
import { ChevronDown, CircleCheck, X } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

import { caretOn, Ease, interp } from "../lib/anim"

type ButtonProps = {
  variant?: "primary" | "outline" | "ghost"
  children: ReactNode
  /** The data-t name the cursor and camera aim at. */
  target?: string
  pressedNow?: boolean
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

export function Button({ variant = "primary", children, target, pressedNow, className = "", style, disabled }: ButtonProps) {
  const look = {
    primary: "bg-app-brand text-white",
    outline: "border border-app-border bg-app-bg text-app-fg",
    ghost: "text-app-fg",
  }[variant]
  return (
    <div
      data-t={target}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-[0.75rem] font-medium whitespace-nowrap ${look} ${className}`}
      style={{ transform: pressedNow ? "scale(0.95)" : undefined, filter: pressedNow ? "brightness(0.85)" : undefined, opacity: disabled ? 0.5 : 1, ...style }}
    >
      {children}
    </div>
  )
}

/** A text input. `value` is what has been typed so far (see typed() in lib/anim); `focused` shows the ring and caret. */
export function Input({ value, placeholder, focused, f = 0, target, masked, className = "" }: { value: string; placeholder?: string; focused?: boolean; f?: number; target?: string; masked?: boolean; className?: string }) {
  const shown = masked ? "•".repeat(value.length) : value
  return (
    <div data-t={target} className={`bg-app-bg flex h-9 items-center rounded-md border px-3 text-[0.75rem] ${focused ? "border-app-brand ring-app-brand/20 ring-2" : "border-app-border"} ${className}`}>
      {value ? <span>{shown}</span> : !focused && <span className="text-app-mfg">{placeholder}</span>}
      {focused && caretOn(f) && <span className="bg-app-fg ml-px inline-block h-4 w-px" />}
    </div>
  )
}

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <div className="mb-1.5 flex items-center gap-1 text-[0.75rem] font-medium">
      {children}
      {required && <span className="text-red-600">*</span>}
    </div>
  )
}

type Option = { label: string; note?: string; disabled?: boolean }

/** How open a menu is at frame f: 0 closed, 1 open. */
const openness = (f: number, openAt: number, closeAt: number) => Math.min(interp(f, [openAt, openAt + 6], [0, 1], Ease.out), interp(f, [closeAt, closeAt + 6], [1, 0], Ease.in))

/** A select trigger with its option list open between `openAt` and `closeAt`. */
export function Select({ f, value, placeholder, options, openAt = Infinity, closeAt = Infinity, highlighted, target, optionTarget }: { f: number; value?: string; placeholder: string; options: Option[]; openAt?: number; closeAt?: number; highlighted?: string; target?: string; optionTarget?: (label: string) => string }) {
  const t = openness(f, openAt, closeAt)
  return (
    <div className="relative">
      <div data-t={target} className={`bg-app-bg flex h-9 items-center justify-between rounded-md border px-3 text-[0.75rem] ${t > 0 ? "border-app-brand" : "border-app-border"}`}>
        <span className={value ? "" : "text-app-mfg"}>{value ?? placeholder}</span>
        <ChevronDown size={15} className="text-app-mfg" style={{ transform: t > 0 ? "rotate(180deg)" : undefined }} />
      </div>
      {options.length > 0 && <OptionList t={t} options={options} highlighted={highlighted} optionTarget={optionTarget} className="top-10 right-0 left-0" />}
    </div>
  )
}

/** A dropdown menu under a button, open between `openAt` and `closeAt`. Place it inside a `relative` wrapper. */
export function Menu({ f, options, openAt, closeAt = Infinity, highlighted, optionTarget, className = "top-10 right-0 w-56" }: { f: number; options: Option[]; openAt: number; closeAt?: number; highlighted?: string; optionTarget?: (label: string) => string; className?: string }) {
  return <OptionList t={openness(f, openAt, closeAt)} options={options} highlighted={highlighted} optionTarget={optionTarget} className={className} />
}

/** Stays mounted while closed, only hidden, so the cursor and camera can measure its options on every frame. */
function OptionList({ t, options, highlighted, optionTarget, className }: { t: number; options: Option[]; highlighted?: string; optionTarget?: (label: string) => string; className: string }) {
  return (
    <div className={`bg-app-bg border-app-border absolute z-30 rounded-md border p-1 shadow-xl ${className}`} style={{ opacity: t, visibility: t > 0 ? "visible" : "hidden", transform: `translateY(${(1 - t) * -6}px)` }}>
      {options.map((o) => (
        <div key={o.label} data-t={optionTarget?.(o.label)} className={`flex items-center justify-between rounded-sm px-2.5 py-1.5 text-[0.75rem] ${o.label === highlighted ? "bg-app-side" : ""} ${o.disabled ? "text-app-mfg" : ""}`}>
          <span className="flex items-center gap-2">{o.label}</span>
          {o.note && <span className="text-app-mfg text-[0.6rem]">{o.note}</span>}
        </div>
      ))}
    </div>
  )
}

/** A modal dialog that fades and scales in at `openAt` and out at `closeAt`. */
export function Dialog({ f, openAt, closeAt = Infinity, children, width = 520, target }: { f: number; openAt: number; closeAt?: number; children: ReactNode; width?: number; target?: string }) {
  if (f < openAt || f > closeAt + 8) return null
  const t = Math.min(interp(f, [openAt, openAt + 8], [0, 1], Ease.out), interp(f, [closeAt, closeAt + 8], [1, 0], Ease.in))
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: `rgba(0,0,0,${0.5 * t})` }}>
      <div data-t={target} className="bg-app-bg border-app-border relative rounded-lg border p-6 shadow-2xl" style={{ width, opacity: t, transform: `scale(${0.95 + 0.05 * t})` }}>
        <X size={16} className="text-app-mfg absolute top-4 right-4" />
        {children}
      </div>
    </div>
  )
}

/** A toast, bottom right of the page, from `at` for `hold` frames. */
export function Toast({ f, at, hold = 75, children }: { f: number; at: number; hold?: number; children: ReactNode }) {
  if (f < at || f > at + hold + 10) return null
  const t = Math.min(interp(f, [at, at + 10], [0, 1], Ease.outBack), interp(f, [at + hold, at + hold + 10], [1, 0], Ease.in))
  return (
    <div className="absolute right-6 bottom-6 z-50" style={{ opacity: Math.min(1, t), transform: `translateY(${(1 - t) * 24}px)` }}>
      <div className="bg-app-bg border-app-border text-app-fg flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[0.75rem] shadow-2xl" style={{ minWidth: 340 }}>
        <CircleCheck size={17} className="text-green-600" />
        {children}
      </div>
    </div>
  )
}

export const Spinner = ({ f, size = 16, color = "currentColor" }: { f: number; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${(f * 14) % 360}deg)` }}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.25" strokeWidth="3" fill="none" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
)
