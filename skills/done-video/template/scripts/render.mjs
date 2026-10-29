// Renders every frame with headless Chrome, in parallel, then encodes them with the soundtrack.
//   node scripts/render.mjs            → out/<output in video.config.json>
//   node scripts/render.mjs --from 600 --to 900   (a slice, for checking)
//   node scripts/render.mjs --no-captions
//   node scripts/render.mjs --theme paper   (another theme from src/themes/)
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { cpus } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"
import { build, preview } from "vite"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const PORT = 5185
const FRAMES = join(ROOT, "out/frames")
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))
const { output } = JSON.parse(readFileSync(join(ROOT, "video.config.json"), "utf8"))

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const from = Number(arg("--from") ?? 0)
const to = Number(arg("--to") ?? timeline.total)
const captions = !process.argv.includes("--no-captions")
const theme = arg("--theme")
const workers = Math.max(2, Math.min(8, cpus().length - 2))
const named = from === 0 && to === timeline.total ? output : `slice-${from}-${to}.mp4`
const out = join(ROOT, "out", arg("--out") ?? (theme ? named.replace(/\.mp4$/, `-${theme}.mp4`) : named))

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

await build({ root: ROOT, logLevel: "warn" })
const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "warn" })
const browser = await chromium.launch({ channel: "chrome", headless: true })

const started = Date.now()
let done = 0
const count = to - from
const chunk = Math.ceil(count / workers)

await Promise.all(
  Array.from({ length: workers }, async (_, w) => {
    const a = from + w * chunk
    const b = Math.min(to, a + chunk)
    if (a >= b) return
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    page.on("pageerror", (err) => console.log(`[worker ${w}]`, err.message))
    await page.goto(`http://localhost:${PORT}/?render${captions ? "" : "&captions=0"}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`)
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
    for (let f = a; f < b; f++) {
      await page.evaluate((n) => window.__setFrame(n), f)
      await page.screenshot({ path: join(FRAMES, `${String(f - from).padStart(5, "0")}.jpg`), type: "jpeg", quality: 100 })
      done++
      if (done % 150 === 0) {
        const rate = done / ((Date.now() - started) / 1000)
        process.stdout.write(`  ${done}/${count} frames · ${rate.toFixed(1)} fps · ~${Math.round((count - done) / rate)}s left\n`)
      }
    }
    await page.close()
  })
)

await browser.close()
server.httpServer.close()
console.log(`Frames done in ${Math.round((Date.now() - started) / 1000)}s`)

const mix = join(ROOT, "out/mix.wav")
const audioArgs = existsSync(mix) ? ["-ss", String(from / timeline.fps), "-t", String(count / timeline.fps), "-i", mix] : []
execFileSync(
  "ffmpeg",
  [
    "-y", "-v", "error",
    "-framerate", String(timeline.fps), "-i", join(FRAMES, "%05d.jpg"),
    ...audioArgs,
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
    ...(audioArgs.length ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" }
)
console.log(`→ ${out}`)
