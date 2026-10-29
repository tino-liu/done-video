import data from "../timeline.json"

export type Word = { w: string; s: number; e: number }

export type SceneTiming = {
  id: string
  /** Global frame the scene starts on. */
  start: number
  duration: number
  /** Frames of picture before the voice starts. */
  lead: number
  /** Frames of voice. */
  voice: number
  transition: "fade" | "dip" | "none"
  /** The voice is the presenter speaking inside a screen recording: mixed drier, captioned in italics. */
  recording: boolean
  /** The step pill shown top left while this scene plays, if any. */
  chapter: string | null
  captions: boolean
  /** Pixels from the bottom of the stage to the captions, raised over a bottom bar. */
  captionBottom: number | null
  audio: string
  text: string
  words: Word[]
}

export type Timeline = { fps: number; voice: string; total: number; scenes: SceneTiming[] }

export const timeline = data as Timeline
export const FPS = timeline.fps

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Scene-local timing helpers, all in frames. */
export function helpers(s: SceneTiming) {
  const toFrame = (seconds: number) => s.lead + Math.round(seconds * FPS)

  /** Index of the first word of the `occurrence`-th match of `phrase`, or -1. */
  const find = (phrase: string, occurrence = 0) => {
    const parts = phrase.split(/\s+/).map(norm)
    let seen = 0
    for (let i = 0; i + parts.length <= s.words.length; i++) {
      if (parts.every((p, k) => norm(s.words[i + k].w) === p)) {
        if (seen === occurrence) return i
        seen++
      }
    }
    return -1
  }

  /** The frame `phrase` starts being spoken. Falls back to a fraction of the scene if it's not in the line. */
  const cue = (phrase: string, occurrence = 0, fallback = 0.5) => {
    const i = find(phrase, occurrence)
    if (i < 0) {
      console.warn(`[${s.id}] cue "${phrase}" not found`)
      return Math.round(s.duration * fallback)
    }
    return toFrame(s.words[i].s)
  }

  /** The frame `phrase` finishes being spoken. */
  const cueEnd = (phrase: string, occurrence = 0, fallback = 0.5) => {
    const i = find(phrase, occurrence)
    if (i < 0) return Math.round(s.duration * fallback)
    return toFrame(s.words[i + phrase.split(/\s+/).length - 1].e)
  }

  return { cue, cueEnd, dur: s.duration, voiceStart: s.lead, voiceEnd: s.lead + s.voice }
}

export type Helpers = ReturnType<typeof helpers>
