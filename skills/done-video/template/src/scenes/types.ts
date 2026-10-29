import type { FC } from "react"

import type { Helpers, SceneTiming } from "../lib/timeline"

export type SceneProps = { f: number; s: SceneTiming; h: Helpers }

export type SfxType = "click" | "pop" | "success" | "typing" | "countdown" | "rec" | "chime"

/** A sound effect at a scene-local frame. `len` is for sounds that last, like typing. */
export type SfxEvent = { at: number; type: SfxType; len?: number }

export type SceneDef = { Component: FC<SceneProps>; events?: (h: Helpers) => SfxEvent[] }
