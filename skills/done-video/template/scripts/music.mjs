// Optional: composes a background track with ElevenLabs Music and saves it as public/audio/music.mp3,
// which scripts/audio.mjs then uses instead of the synthesized pad. Needs ELEVENLABS_API_KEY in .env
// and a plan with Music access.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))
const env = Object.fromEntries(
  (existsSync(join(ROOT, ".env")) ? readFileSync(join(ROOT, ".env"), "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
)
const apiKey = env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEY
if (!apiKey) throw new Error("Set ELEVENLABS_API_KEY in .env first")

const PROMPT =
  "Modern, warm corporate tech product demo background music. Light electronic pulse, soft synth pads, gentle plucked arpeggio, " +
  "optimistic and calm, steady 100 BPM, no vocals, no big drops, stays in the background under a voiceover, clean ending."
const lengthMs = Math.ceil((timeline.total / timeline.fps + 1) * 1000)

const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", {
  method: "POST",
  headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: PROMPT, music_length_ms: lengthMs }),
})
if (!res.ok) throw new Error(`ElevenLabs Music ${res.status}: ${await res.text()}`)
writeFileSync(join(ROOT, "public/audio/music.mp3"), Buffer.from(await res.arrayBuffer()))
console.log(`Saved public/audio/music.mp3 (${(lengthMs / 1000).toFixed(0)}s). Run npm run mix to use it.`)
