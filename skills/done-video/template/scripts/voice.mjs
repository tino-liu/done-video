// Generates one voice clip per scene and writes src/timeline.json (scene starts, lengths and word
// timings), which the video reads.
//
// With ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env it uses ElevenLabs' with-timestamps
// endpoint, so captions and on-screen cues land on the exact word. Without them it uses the
// operating system's own voice as a placeholder (macOS `say`, Windows SAPI, or espeak-ng on Linux)
// and spreads the words over the clip by length.
//
// Clips are cached by a hash of voice + text, so re-running only pays for lines that changed.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { FPS, scenes } from "./scenes.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const AUDIO_DIR = join(ROOT, "public/audio/voice")
const TIMELINE = join(ROOT, "src/timeline.json")
const config = JSON.parse(readFileSync(join(ROOT, "video.config.json"), "utf8")).voice

// Words the voice gets wrong, respelled for speech only (video.config.json → voice.sayAs). Captions
// and on-screen cues keep the written form, so the timings are mapped back after generation.
const SAY_AS = config.sayAs ?? []

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const toSpeech = (text) => SAY_AS.reduce((t, { written, spoken }) => t.replace(new RegExp(`\\b${escapeRegExp(written)}`, "g"), spoken), text)

/** Folds respelled words back into their written form, keeping any trailing "'s" or punctuation. */
function toWritten(words) {
  const out = []
  for (let i = 0; i < words.length; i++) {
    const rule = SAY_AS.find(({ spoken }) => {
      const parts = spoken.split(" ")
      return parts.every((p, k) => words[i + k] && (k === parts.length - 1 ? words[i + k].w.startsWith(p) : words[i + k].w === p))
    })
    if (!rule) {
      out.push(words[i])
      continue
    }
    const parts = rule.spoken.split(" ")
    const last = words[i + parts.length - 1]
    out.push({ w: rule.written + last.w.slice(parts[parts.length - 1].length), s: words[i].s, e: last.e })
    i += parts.length - 1
  }
  return out
}

function loadEnv() {
  const path = join(ROOT, ".env")
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=")
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
      })
  )
}

const env = { ...loadEnv(), ...process.env }
const apiKey = env.ELEVENLABS_API_KEY
const voiceId = env.ELEVENLABS_VOICE_ID
const ELEVEN_MODEL = env.ELEVENLABS_MODEL_ID || config.model
const ELEVEN_SETTINGS = config.settings
const useEleven = Boolean(apiKey && voiceId) && !process.argv.includes("--placeholder")
// Scenes to generate again even when cached, for a take that came out wrong: --reroll=title,record
const reroll = process.argv.find((a) => a.startsWith("--reroll="))?.slice("--reroll=".length).split(",") ?? []

/**
 * A Professional Voice Clone only speaks through models it has finished training on. Returns a
 * fingerprint of its training samples, so adding samples and retraining regenerates every clip.
 */
async function checkVoiceReady() {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { headers: { "xi-api-key": apiKey } })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} looking up voice ${voiceId}: ${await res.text()}`)
  const voice = await res.json()
  const state = voice.fine_tuning?.state?.[ELEVEN_MODEL]
  if (voice.category === "professional" && state !== "fine_tuned") {
    console.error(`Voice "${voice.name}" is still training on ${ELEVEN_MODEL} (${state ?? "not started"}). Try again once ElevenLabs shows it as ready, or run with --placeholder.`)
    process.exit(2)
  }
  const sampleHashes = (voice.samples ?? []).map((s) => s.hash).sort()
  return createHash("sha1").update(sampleHashes.join("\n")).digest("hex").slice(0, 8)
}

function probeSeconds(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
  return Number(out.toString().trim())
}

/** Words with start/end seconds from ElevenLabs' character alignment. */
function wordsFromAlignment(alignment) {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment
  const words = []
  let current = null
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) words.push(current)
      current = null
      return
    }
    if (!current) current = { w: "", s: starts[i], e: ends[i] }
    current.w += ch
    current.e = ends[i]
  })
  if (current) words.push(current)
  return words
}

/** Placeholder timings: spread words over the clip by length, with pauses at punctuation. */
function estimateWords(text, seconds) {
  const tokens = text.split(/\s+/).filter(Boolean)
  const weight = (t) => t.length + 2 + (/[.,?!:;]$/.test(t) ? 4 : 0)
  const total = tokens.reduce((sum, t) => sum + weight(t), 0)
  let at = 0
  return tokens.map((t) => {
    const span = (weight(t) / total) * seconds
    const word = { w: t, s: at, e: at + span * 0.85 }
    at += span
    return word
  })
}

async function elevenClip(scene, file, previous, next) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_192`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    // The neighbouring lines are context only, so the intonation runs on from one scene to the next.
    body: JSON.stringify({
      text: toSpeech(scene.text),
      model_id: ELEVEN_MODEL,
      voice_settings: ELEVEN_SETTINGS,
      previous_text: previous ? toSpeech(previous.text) : undefined,
      next_text: next ? toSpeech(next.text) : undefined,
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} for "${scene.id}": ${await res.text()}`)
  const json = await res.json()
  writeFileSync(file, Buffer.from(json.audio_base64, "base64"))
  return toWritten(wordsFromAlignment(json.alignment))
}

const PLACEHOLDER_ENGINE = { darwin: `say:${config.placeholder.mac}:${config.placeholder.wpm}`, win32: "sapi" }[process.platform] ?? "espeak-ng"

/** Speaks the line with the operating system's voice into a WAV, then encodes it like an ElevenLabs clip. */
function placeholderClip(scene, file) {
  const wav = file.replace(/\.mp3$/, ".wav")
  const text = toSpeech(scene.text)
  if (process.platform === "darwin") {
    execFileSync("say", ["-v", config.placeholder.mac, "-r", String(config.placeholder.wpm), "-o", wav, "--data-format=LEI16@44100", text])
  } else if (process.platform === "win32") {
    const ps = "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile($env:DV_OUT); $s.Speak($env:DV_TEXT); $s.Dispose()"
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { env: { ...process.env, DV_OUT: wav, DV_TEXT: text } })
  } else {
    execFileSync("espeak-ng", ["-w", wav, text])
  }
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-ar", "44100", "-b:a", "192k", file])
  rmSync(wav)
  return null
}

mkdirSync(AUDIO_DIR, { recursive: true })
const voiceVersion = useEleven ? await checkVoiceReady() : null
console.log(useEleven ? `Voice: ElevenLabs ${voiceId}` : `Voice: placeholder (${PLACEHOLDER_ENGINE})`)

let start = 0
const timeline = { fps: FPS, voice: useEleven ? "elevenlabs" : "placeholder", total: 0, scenes: [] }

for (const [index, scene] of scenes.entries()) {
  const engine = useEleven ? `eleven:${voiceId}:${voiceVersion}:${ELEVEN_MODEL}:${JSON.stringify(ELEVEN_SETTINGS)}` : PLACEHOLDER_ENGINE
  const hash = createHash("sha1").update(`${engine}\n${toSpeech(scene.text)}`).digest("hex").slice(0, 10)
  const name = `${scene.id}-${hash}.mp3`
  const file = join(AUDIO_DIR, name)
  const wordsFile = file.replace(/\.mp3$/, ".words.json")

  let words
  if (existsSync(file) && existsSync(wordsFile) && !reroll.includes(scene.id)) {
    words = JSON.parse(readFileSync(wordsFile, "utf8"))
  } else {
    process.stdout.write(`  generating ${scene.id}… `)
    words = useEleven ? await elevenClip(scene, file, scenes[index - 1], scenes[index + 1]) : placeholderClip(scene, file)
    if (!words) words = estimateWords(scene.text, probeSeconds(file))
    writeFileSync(wordsFile, JSON.stringify(words))
    console.log("done")
  }

  const voiceSeconds = probeSeconds(file)
  const lead = Math.round(scene.lead * FPS)
  const voice = Math.ceil(voiceSeconds * FPS)
  const duration = Math.max(lead + voice + Math.round(scene.tail * FPS), Math.round((scene.minSeconds ?? 0) * FPS))

  timeline.scenes.push({
    id: scene.id,
    start,
    duration,
    lead,
    voice,
    transition: scene.transition,
    recording: Boolean(scene.recording),
    chapter: scene.chapter ?? null,
    captions: scene.captions ?? true,
    captionBottom: scene.captionBottom ?? null,
    audio: `audio/voice/${name}`,
    text: scene.text,
    words,
  })
  start += duration
}

timeline.total = start
writeFileSync(TIMELINE, JSON.stringify(timeline, null, 1))
console.log(`Timeline: ${(start / FPS).toFixed(1)}s across ${scenes.length} scenes`)
for (const s of timeline.scenes) console.log(`  ${s.id.padEnd(18)} ${(s.start / FPS).toFixed(1).padStart(6)}s  +${(s.duration / FPS).toFixed(1)}s`)
