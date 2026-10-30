// Builds the soundtrack: voice clips at their scene offsets, synthesized UI sound effects on the
// frames the scenes report, and a quiet music bed that ducks under the voice.
//
// Writes out/mix.wav (for the final render) and public/audio/mix.m4a (for the preview player), plus
// each bus on its own and the sound effects' frames, which scripts/review.mjs checks.
// A music file at public/audio/music.mp3 (e.g. from ElevenLabs Music) replaces the synthesized bed.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"
import { build, preview } from "vite"

import { decode, RATE, speechEnd, strayPauses } from "./sound.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const PORT = 5184
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))
const FPS = timeline.fps
const videoSeconds = timeline.total / FPS
const totalSeconds = videoSeconds + 0.5
const N = Math.ceil(totalSeconds * RATE)

const VOICE_GAIN = 1.0
const SFX_GAIN = 0.32
const MUSIC_GAIN = 0.16
const DUCK_TO = 0.35

// ---------- events from the scenes ----------
async function sceneEvents() {
  await build({ root: ROOT, logLevel: "warn" })
  const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "warn" })
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(`http://localhost:${PORT}/?render`)
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
  const events = await page.evaluate(() => window.__events())
  await browser.close()
  server.httpServer.close()
  return events
}

// ---------- tiny synth ----------
let seed = 1234567
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

function tone(freq, seconds, { decay = 8, attack = 0.004, type = "sine", gain = 1 } = {}) {
  const n = Math.floor(seconds * RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const phase = 2 * Math.PI * freq * t
    const wave = type === "tri" ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)
    const env = Math.min(1, t / attack) * Math.exp(-decay * t)
    out[i] = wave * env * gain
  }
  return out
}

function noise(seconds, { decay = 60, lowpass = 0.5, gain = 1 } = {}) {
  const n = Math.floor(seconds * RATE)
  const out = new Float32Array(n)
  let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    lp += lowpass * (rand() * 2 - 1 - lp)
    out[i] = lp * Math.exp(-decay * t) * gain
  }
  return out
}

function mixInto(target, src, atSeconds, gain = 1) {
  const off = Math.floor(atSeconds * RATE)
  for (let i = 0; i < src.length && off + i < target.length; i++) if (off + i >= 0) target[off + i] += src[i] * gain
}

function concat(...parts) {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const SFX = {
  click: () => {
    const body = noise(0.03, { decay: 180, lowpass: 0.6, gain: 0.9 })
    mixInto(body, tone(2400, 0.02, { decay: 220, gain: 0.25 }), 0)
    return body
  },
  pop: () => {
    const n = Math.floor(0.14 * RATE)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / RATE
      const f = 420 + 700 * Math.exp(-35 * t)
      out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-28 * t) * 0.8
    }
    return out
  },
  success: () => {
    const out = new Float32Array(Math.floor(0.9 * RATE))
    mixInto(out, tone(880, 0.8, { decay: 6, gain: 0.45 }), 0)
    mixInto(out, tone(1318.5, 0.7, { decay: 6, gain: 0.4 }), 0.09)
    return out
  },
  chime: () => {
    const out = new Float32Array(Math.floor(1.4 * RATE))
    ;[1046.5, 1318.5, 1568, 2093].forEach((f, i) => mixInto(out, tone(f, 1.1, { decay: 4.5, gain: 0.32, type: "tri" }), i * 0.07))
    return out
  },
  countdown: () => tone(1000, 0.12, { decay: 30, gain: 0.5 }),
  rec: () => concat(tone(1400, 0.1, { decay: 25, gain: 0.5 }), tone(1870, 0.18, { decay: 18, gain: 0.5 })),
  typing: (seconds) => {
    const out = new Float32Array(Math.floor((seconds + 0.1) * RATE))
    let t = 0
    while (t < seconds) {
      mixInto(out, noise(0.02, { decay: 260, lowpass: 0.35 + rand() * 0.3, gain: 0.45 + rand() * 0.3 }), t)
      t += 0.05 + rand() * 0.06
    }
    return out
  },
}

// ---------- music bed ----------
function musicBed() {
  const external = join(ROOT, "public/audio/music.mp3")
  if (existsSync(external)) {
    console.log("Music: public/audio/music.mp3")
    return decode(external)
  }
  console.log("Music: synthesized pad")
  const out = new Float32Array(N)
  // Cmaj9 → Am9 → Fmaj9 → G6, four bars of 3.2 s, voiced low and soft.
  const chords = [
    [130.81, 196.0, 246.94, 293.66],
    [110.0, 164.81, 196.0, 246.94],
    [87.31, 130.81, 164.81, 220.0],
    [98.0, 146.83, 196.0, 246.94],
  ]
  const bar = 3.2
  for (let b = 0; b * bar < totalSeconds; b++) {
    const chord = chords[b % chords.length]
    const start = Math.floor(b * bar * RATE)
    const len = Math.floor((bar + 1.2) * RATE)
    for (const f of chord) {
      for (const detune of [-0.6, 0.6]) {
        for (let i = 0; i < len && start + i < N; i++) {
          const t = i / RATE
          const env = Math.min(1, t / 0.9) * Math.min(1, Math.max(0, (bar + 1.2 - t) / 1.2))
          out[start + i] += Math.sin(2 * Math.PI * (f + detune) * t) * env * 0.05
        }
      }
    }
    // A soft high pluck on each beat keeps it moving.
    for (let k = 0; k < 4; k++) mixInto(out, tone(chord[3] * 2, 0.6, { decay: 7, gain: 0.05, type: "tri" }), b * bar + k * (bar / 4))
  }
  // One-pole lowpass to round it off.
  let lp = 0
  for (let i = 0; i < N; i++) {
    lp += 0.08 * (out[i] - lp)
    out[i] = lp * 2.2
  }
  return out
}

// ---------- mix ----------
const events = await sceneEvents()
console.log(`Sound effects: ${events.length}`)

const CLIP_LUFS = -19
/** The recording sounds smaller after its EQ, so it gets a little back. */
const RECORDING_BOOST_DB = 2

// ElevenLabs sometimes adds a stray sound after a line's last word (a breath, an "sk", static) or in
// one of its pauses, and a cloned voice carries the hiss of the room its samples were recorded in,
// which stops dead where a clip ends. So each clip is cut a moment after its speech ends and faded out
// there, and with ElevenLabs' word timings, a pause holding a stray sound is silenced. Fades on every
// edge keep any of this from clicking. scripts/sound.mjs finds the ends and the pauses.
/** Seconds kept after a line's speech ends, for its last sound to die away. */
const KEEP = 0.12
/** The fade over the end of what is kept. */
const END_FADE = 0.1
/** The fade into a silenced pause and back out of it. */
const PAUSE_FADE = 0.03
/** The fade at a clip's start, and at its end when it is still sounding there: just enough not to click. */
const EDGE_FADE = 0.005

/** Fades `pcm` from `a` to `b` (gains) between two times, in seconds. */
function ramp(pcm, from, to, a, b) {
  const i0 = Math.max(0, Math.round(from * RATE))
  const i1 = Math.min(pcm.length, Math.round(to * RATE))
  for (let i = i0; i < i1; i++) pcm[i] *= a + ((b - a) * (i - i0)) / Math.max(1, i1 - i0)
}

/** The clip with its tail cut and any stray sounds in its pauses silenced, and what was done. */
function cleanVoice(pcm, words, timed) {
  const { end } = speechEnd(pcm, words.at(-1)?.s ?? 0)
  const length = end === null ? pcm.length : Math.min(pcm.length, Math.round((end + KEEP) * RATE))
  const out = pcm.slice(0, length)
  const seconds = length / RATE
  ramp(out, 0, EDGE_FADE, 0, 1)
  // The fade starts after the speech has ended, even in a clip that ends sooner than KEEP after it.
  ramp(out, end === null ? seconds - EDGE_FADE : Math.min(seconds - EDGE_FADE, Math.max(end + KEEP - END_FADE, seconds - END_FADE)), seconds, 1, 0)
  const silenced = timed ? strayPauses(pcm, words) : []
  for (const p of silenced) {
    ramp(out, p.from - PAUSE_FADE, p.from, 1, 0)
    ramp(out, p.from, p.to, 0, 0)
    ramp(out, p.to, p.to + PAUSE_FADE, 0, 1)
  }
  return { pcm: out, cut: length < pcm.length ? seconds : null, silenced }
}

/** Integrated loudness in LUFS of the ffmpeg input that `inputArgs` opens, or `fallback` if unreadable. */
function integratedLoudness(inputArgs, fallback) {
  // ebur128 reports on stderr; execFileSync only returns stdout, so read it through spawnSync.
  const report = spawnSync("ffmpeg", ["-hide_banner", ...inputArgs, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr
  // The summary at the end of the report carries the integrated loudness.
  return Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1] ?? fallback)
}

const voice = new Float32Array(N)
for (const s of timeline.scenes) {
  const file = join(ROOT, "public", s.audio)
  const measured = integratedLoudness(["-i", file], CLIP_LUFS)
  const gain = CLIP_LUFS - measured + (s.recording ? RECORDING_BOOST_DB : 0)
  const clean = cleanVoice(decode(file), s.words, timeline.voice === "elevenlabs")
  // Level-match every clip, then make a recording scene sound like the presenter's own screen
  // recording: drier and a little narrower, like a laptop mic in a room.
  const filter = `volume=${gain.toFixed(2)}dB${s.recording ? ",highpass=f=140,lowpass=f=7000,aecho=0.9:0.9:35:0.12" : ""}`
  const notes = [clean.cut === null ? "" : `cut at ${clean.cut.toFixed(2)}s`, ...clean.silenced.map((p) => `silenced a sound between "${p.after}" and "${p.before}"`)].filter(Boolean)
  console.log(`  ${s.id.padEnd(17)} ${measured.toFixed(1)} LUFS → ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB${notes.length ? `, ${notes.join(", ")}` : ""}`)
  mixInto(voice, decode(clean.pcm, filter), (s.start + s.lead) / FPS, VOICE_GAIN)
}

const sfx = new Float32Array(N)
for (const e of events) {
  const make = SFX[e.type]
  if (!make) continue
  mixInto(sfx, e.type === "typing" ? make((e.len ?? 15) / FPS) : make(), e.at / FPS)
}

const music = musicBed()
// Duck the music under the voice with a smoothed envelope follower.
let env = 0
const attack = Math.exp(-1 / (0.03 * RATE))
const release = Math.exp(-1 / (0.45 * RATE))
const outL = new Float32Array(N)
const outR = new Float32Array(N)
const fadeOut = 2.5
/** Everything fades to silence over the video's last moment, so the last frame cuts nothing off. */
const CLOSE = 0.3
for (let i = 0; i < N; i++) {
  const level = Math.abs(voice[i])
  env = level > env ? attack * env + (1 - attack) * level : release * env + (1 - release) * level
  const duck = 1 - (1 - DUCK_TO) * Math.min(1, env * 12)
  const t = i / RATE
  const musicFade = Math.min(1, t / 1.5) * Math.min(1, Math.max(0, (videoSeconds - t) / fadeOut))
  const close = Math.min(1, Math.max(0, (videoSeconds - t) / CLOSE))
  const m = (music[i] ?? 0) * MUSIC_GAIN * duck * musicFade
  const v = voice[i] + sfx[i] * SFX_GAIN
  outL[i] = (v + m) * close
  outR[i] = (v + m) * close
}

mkdirSync(join(ROOT, "out"), { recursive: true })

// Each bus on its own (out/stem-voice.wav, …), for checking one in isolation; scripts/review.mjs reads the voice.
for (const [name, bus] of Object.entries({ voice, sfx, music })) {
  const stem = join(ROOT, `out/stem-${name}.f32`)
  writeFileSync(stem, Buffer.from(bus.buffer, bus.byteOffset, Math.min(bus.length, N) * 4))
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "f32le", "-ar", String(RATE), "-ac", "1", "-i", stem, "-c:a", "pcm_s16le", stem.replace(/\.f32$/, ".wav")])
  execFileSync("rm", [stem])
}
writeFileSync(join(ROOT, "out/events.json"), JSON.stringify(events))

// Interleave and write a 32-bit float WAV, then bring it to -16 LUFS with one gain for the whole mix.
// (loudnorm's one-pass mode rides the gain up through quiet moments, hiss and all.) A limiter holds
// the rare peak under the ceiling, which leaves the AAC encoder room under -1 dBTP.
const TARGET_LUFS = -16
const CEILING_DB = -2
const raw = Buffer.alloc(N * 2 * 4)
for (let i = 0; i < N; i++) {
  raw.writeFloatLE(outL[i], i * 8)
  raw.writeFloatLE(outR[i], i * 8 + 4)
}
const rawPath = join(ROOT, "out/mix.f32")
writeFileSync(rawPath, raw)
const rawInput = ["-f", "f32le", "-ar", String(RATE), "-ac", "2", "-i", rawPath]
const lift = TARGET_LUFS - integratedLoudness(rawInput, TARGET_LUFS)
const wav = join(ROOT, "out/mix.wav")
const master = `volume=${lift.toFixed(2)}dB,alimiter=limit=${(10 ** (CEILING_DB / 20)).toFixed(4)}:attack=5:release=50:level=false:latency=true`
execFileSync("ffmpeg", ["-y", "-v", "error", ...rawInput, "-af", master, "-ar", String(RATE), "-c:a", "pcm_s16le", wav])
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-c:a", "aac", "-b:a", "192k", join(ROOT, "public/audio/mix.m4a")])
execFileSync("rm", [rawPath])
console.log(`Mixed ${totalSeconds.toFixed(1)}s → out/mix.wav, public/audio/mix.m4a; stems in out/stem-*.wav`)
