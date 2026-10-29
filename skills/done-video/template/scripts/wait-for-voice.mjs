// Waits until the Professional Voice Clone in .env has finished training on the voice model, checking
// every few minutes. Exits 0 when it's ready, 1 if training failed, 3 after MAX_HOURS.
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const env = Object.fromEntries(
  (existsSync(join(ROOT, ".env")) ? readFileSync(join(ROOT, ".env"), "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
)
const MODEL = env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"
const CHECK_EVERY_MS = 5 * 60 * 1000
const MAX_HOURS = 12

const started = Date.now()
for (;;) {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${env.ELEVENLABS_VOICE_ID}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } })
  const voice = res.ok ? await res.json() : null
  const state = voice ? (voice.fine_tuning?.state?.[MODEL] ?? "not started (verify and train it in ElevenLabs)") : `HTTP ${res.status}`
  console.log(`${new Date().toLocaleTimeString()} ${MODEL}: ${state}`)
  if (state === "fine_tuned") process.exit(0)
  if (state === "failed") process.exit(1)
  if (Date.now() - started > MAX_HOURS * 3600 * 1000) process.exit(3)
  await new Promise((r) => setTimeout(r, CHECK_EVERY_MS))
}
