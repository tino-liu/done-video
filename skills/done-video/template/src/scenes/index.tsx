import { helpers, timeline } from "../lib/timeline"
import { demo } from "./Demo"
import { intro } from "./Intro"
import { outro } from "./Outro"
import { title } from "./Title"
import type { SceneDef, SfxEvent } from "./types"

/** Scene ids from scripts/scenes.mjs → the component that draws them. */
export const registry: Record<string, SceneDef> = {
  intro,
  title,
  demo,
  outro,
}

/** Every sound effect in the video, on global frames, for scripts/audio.mjs. */
export function allEvents(): SfxEvent[] {
  return timeline.scenes.flatMap((s) => (registry[s.id]?.events?.(helpers(s)) ?? []).map((e) => ({ ...e, at: e.at + s.start })))
}
