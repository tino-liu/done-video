// Reads a voice clip's samples to find where its line ends and any stray sounds in its pauses (a
// breath, an "sk", a click, static). scripts/audio.mjs cleans each clip with these before mixing, and
// scripts/review.mjs checks the mixed voice with them.
import { execFileSync } from "node:child_process"

export const RATE = 48000
/** Seconds per level reading. */
export const WINDOW = 0.01

/** Mono float samples at RATE from a file or from samples, through an optional ffmpeg filter. */
export function decode(input, filter) {
  const fromSamples = input instanceof Float32Array
  const args = ["-v", "error", ...(fromSamples ? ["-f", "f32le", "-ar", String(RATE), "-ac", "1", "-i", "-"] : ["-i", input])]
  if (filter) args.push("-af", filter)
  args.push("-ac", "1", "-ar", String(RATE), "-f", "f32le", "-")
  const options = { maxBuffer: 1024 * 1024 * 1024, ...(fromSamples ? { input: Buffer.from(input.buffer, input.byteOffset, input.length * 4) } : {}) }
  const buf = execFileSync("ffmpeg", args, options)
  // Copied, so the samples are aligned and can be changed in place.
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length))
}

/** The level of each WINDOW of samples, in dBFS. */
export function levels(pcm) {
  const size = Math.round(WINDOW * RATE)
  const db = []
  for (let i = 0; i + size <= pcm.length; i += size) {
    let sum = 0
    for (let k = i; k < i + size; k++) sum += pcm[k] * pcm[k]
    db.push(10 * Math.log10(sum / size + 1e-12))
  }
  return db
}

/** Quieter than this, a window is a gap between sounds. */
const QUIET_DB = -42
/** As loud as this, a sound could be speech. */
const SPEECH_DB = -30
/** A gap this long ends a word; the closure before a "t" or "k" is shorter. */
const MIN_GAP = 0.12
/** A sound no longer than this that runs on to the clip's end, after the line has stopped, is tacked on. */
const END_BURST = 0.45
/**
 * Above this, a sound's sample-to-sample change carries more energy than a vowel's does: it is
 * noise-like (static, a breath, an "sk") rather than voiced. Words score 0.001–0.3, static about 0.8.
 */
const NOISE_LIKE = 0.5
/** Pauses shorter than this are part of the flow of speech. */
const PAUSE_MIN = 0.25
/** How far a pause starts after the word before it ends, and stops before the next word starts. */
const PAUSE_PAD = { after: 0.08, before: 0.05 }
/** Within this of the clip's hiss, a window holds only hiss. */
const HISS_ONLY_DB = 6
/** A sound in a pause that peaks this far above the hiss is a stray one. */
const STRAY_DB = 12
/** A stray sound in a pause has hiss alone this long on either side, so a word's start or end is never taken for one. */
const ISOLATION = 0.04
/** The share of a clip's windows quieter than its hiss level. */
const HISS_PERCENTILE = 0.1

/** The level of the clip's background hiss: a tenth of the clip is quieter. */
function hiss(db) {
  const sorted = [...db].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * HISS_PERCENTILE)] ?? QUIET_DB
}

/** How noise-like the samples between two times are: the energy of their change over their energy. */
function noisiness(pcm, from, to) {
  let energy = 0
  let change = 0
  for (let i = Math.max(1, Math.round(from * RATE)); i < Math.min(pcm.length, Math.round(to * RATE)); i++) {
    energy += pcm[i] * pcm[i]
    change += (pcm[i] - pcm[i - 1]) ** 2
  }
  return change / (energy + 1e-12)
}

/** Whether a sound between two times could be a word: as loud as speech, and voiced. */
const couldBeSpeech = (pcm, db, from, to) => Math.max(...db.slice(Math.floor(from / WINDOW), Math.ceil(to / WINDOW))) > SPEECH_DB && noisiness(pcm, from, to) < NOISE_LIKE

/**
 * Where a line's speech ends: the start of the first gap after its last word begins that no word
 * could follow. A sound after that gap is a stray one when it is quieter than speech, noise-like, or a
 * short burst running on to the clip's end. `end` is null when the clip is still sounding at its end.
 * `loud` is when a sound after such a gap could be a word, which keeps the line running past it: a
 * word the timings put too early, or one the voice made up.
 */
export function speechEnd(pcm, lastWordStart) {
  const db = levels(pcm)
  const gap = Math.round(MIN_GAP / WINDOW)
  const quietRun = (from) => {
    let len = 0
    while (from + len < db.length && db[from + len] <= QUIET_DB) len++
    return len
  }
  let loud = null
  for (let w = Math.ceil(lastWordStart / WINDOW); w < db.length; w++) {
    const len = quietRun(w)
    if (len < gap && !(len > 0 && w + len === db.length)) {
      w += len
      continue
    }
    // The sounds after the gap, each up to the next gap, until one could be a word.
    let next = w + len
    let word = null
    while (next < db.length && word === null) {
      let stop = next
      while (stop < db.length && quietRun(stop) < gap) stop += Math.max(1, quietRun(stop))
      const tacked = stop >= db.length && (stop - next) * WINDOW <= END_BURST
      if (!tacked && couldBeSpeech(pcm, db, next * WINDOW, stop * WINDOW)) word = next
      next = stop + quietRun(stop)
    }
    if (word === null) return { end: w * WINDOW, loud }
    loud ??= word * WINDOW
    w = word
  }
  return { end: null, loud }
}

/**
 * Stray sounds in the pauses between words, as { from, to } seconds with the words either side:
 * sounds standing out from the hiss, with hiss alone before and after them inside the pause, that
 * couldn't be a word. Needs real word timings (ElevenLabs), not estimated ones.
 */
export function strayPauses(pcm, words) {
  const db = levels(pcm)
  // Measured before the last word, which a mixed clip's silence after its cut can't reach.
  const floor = hiss(db.slice(0, Math.floor((words.at(-1)?.s ?? 0) / WINDOW)))
  const sounding = (w) => db[w] > floor + HISS_ONLY_DB
  const margin = Math.round(ISOLATION / WINDOW)
  const out = []
  for (let i = 0; i + 1 < words.length; i++) {
    if (words[i + 1].s - words[i].e < PAUSE_MIN) continue
    const first = Math.ceil((words[i].e + PAUSE_PAD.after) / WINDOW)
    const last = Math.min(db.length, Math.floor((words[i + 1].s - PAUSE_PAD.before) / WINDOW))
    for (let w = first; w < last; w++) {
      if (!sounding(w)) continue
      let stop = w
      while (stop < last && sounding(stop)) stop++
      const hissAround = [...db.slice(Math.max(0, w - margin), w), ...db.slice(stop, stop + margin)].every((d) => d <= floor + HISS_ONLY_DB)
      const stray = stop < last && hissAround && Math.max(...db.slice(w, stop)) > floor + STRAY_DB && !couldBeSpeech(pcm, db, w * WINDOW, stop * WINDOW)
      if (stray) out.push({ from: w * WINDOW, to: stop * WINDOW, after: words[i].w, before: words[i + 1].w })
      w = stop
    }
  }
  return out
}
