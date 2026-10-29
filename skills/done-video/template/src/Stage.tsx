import { Ease, interp } from "./lib/anim"
import { helpers, timeline } from "./lib/timeline"
import type { SceneTiming } from "./lib/timeline"
import { Backdrop, Captions, ChapterHeader } from "./components/Overlays"
import { STAGE_H, STAGE_W } from "./components/Camera"
import { registry } from "./scenes"

/** Frames the incoming scene takes to fade over the outgoing one. */
const CROSSFADE = 14
/** Frames of a dip: the outgoing scene fades to the backdrop, then the incoming one fades in, so two
 *  centred text cards never show through each other. */
const DIP = 18
const DIP_HALF = DIP / 2

export function sceneIndexAt(frame: number) {
  const i = timeline.scenes.findIndex((s) => frame < s.start + s.duration)
  return i < 0 ? timeline.scenes.length - 1 : i
}

function SceneLayer({ s, f, opacity, scale = 1, pass }: { s: SceneTiming; f: number; opacity: number; scale?: number; pass: number }) {
  const def = registry[s.id]
  if (!def) return null
  const { Component } = def
  return (
    <div className="absolute inset-0" style={{ opacity, transform: scale === 1 ? undefined : `scale(${scale})` }} data-pass={pass}>
      <Component f={f} s={s} h={helpers(s)} />
    </div>
  )
}

/** One frame of the video, 1920×1080. `pass` re-renders the same frame so DOM-measured targets settle. */
export function Stage({ frame, pass = 0, captions = true }: { frame: number; pass?: number; captions?: boolean }) {
  const idx = sceneIndexAt(frame)
  const cur = timeline.scenes[idx]
  const prev = idx > 0 ? timeline.scenes[idx - 1] : undefined
  const local = frame - cur.start
  const fading = prev !== undefined && cur.transition === "fade" && local < CROSSFADE
  const dipping = prev !== undefined && cur.transition === "dip" && local < DIP
  const incoming = fading ? interp(local, [0, CROSSFADE], [0, 1], Ease.inOut) : dipping ? interp(local, [DIP_HALF, DIP], [0, 1], Ease.inOut) : 1
  const settle = fading ? interp(local, [0, CROSSFADE], [1.025, 1], Ease.out) : dipping ? interp(local, [DIP_HALF, DIP], [1.025, 1], Ease.out) : 1

  return (
    <div className="relative overflow-hidden" style={{ width: STAGE_W, height: STAGE_H }}>
      <Backdrop g={frame} />
      {(fading || dipping) && <SceneLayer key={prev.id} s={prev} f={frame - prev.start} opacity={dipping ? interp(local, [0, DIP_HALF], [1, 0], Ease.inOut) : 1} pass={pass} />}
      <SceneLayer key={cur.id} s={cur} f={local} opacity={incoming} scale={settle} pass={pass} />
      <ChapterHeader scene={cur} local={local} prev={prev} />
      {captions && <Captions scene={cur} local={local} />}
    </div>
  )
}
