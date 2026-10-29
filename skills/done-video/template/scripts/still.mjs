// Renders individual frames to PNG for checking a scene without rendering the whole video.
//   node scripts/still.mjs 120 400 2.5s demo+3s
//   node scripts/still.mjs --sheet intro+2s title+1s demo+4s outro+3s
// A number is a frame; "2.5s" is seconds; "scene+3s" is seconds into a scene. Output goes to
// out/stills; --sheet also tiles them, two across, into out/stills/sheet.png.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"
import { build, preview } from "vite"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const OUT = join(ROOT, "out/stills")
const PORT = 5183
const SHEET_COLUMNS = 2
const SHEET_WIDTH = 1600
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))

function toFrame(arg) {
  const m = arg.match(/^([a-z0-9-]+)\+([\d.]+)s?$/)
  if (m) {
    const scene = timeline.scenes.find((s) => s.id === m[1])
    if (!scene) throw new Error(`No scene ${m[1]}`)
    return scene.start + Math.round(Number(m[2]) * timeline.fps)
  }
  if (arg.endsWith("s")) return Math.round(Number(arg.slice(0, -1)) * timeline.fps)
  return Number(arg)
}

const args = process.argv.slice(2)
const sheet = args.includes("--sheet")
const frames = args.filter((a) => !a.startsWith("--")).map(toFrame)
mkdirSync(OUT, { recursive: true })

await build({ root: ROOT, logLevel: "warn" })
const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "warn" })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
page.on("console", (msg) => ["error", "warning"].includes(msg.type()) && console.log("[page]", msg.text()))
page.on("pageerror", (err) => console.log("[page error]", err.message))
await page.goto(`http://localhost:${PORT}/?render`)
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })

const files = []
for (const frame of frames) {
  await page.evaluate((n) => window.__setFrame(n), frame)
  const file = join(OUT, `f${String(frame).padStart(5, "0")}.png`)
  await page.screenshot({ path: file })
  files.push(file)
  console.log(file)
}

await browser.close()
server.httpServer.close()

if (sheet && files.length > 1) {
  // xstack places each tile by the widths and heights of the tiles before it: w0 = one tile across.
  const layout = files.map((_, i) => {
    const col = i % SHEET_COLUMNS
    const row = Math.floor(i / SHEET_COLUMNS)
    const x = col === 0 ? "0" : Array(col).fill("w0").join("+")
    const y = row === 0 ? "0" : Array(row).fill("h0").join("+")
    return `${x}_${y}`
  })
  const out = join(OUT, "sheet.png")
  execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", `xstack=inputs=${files.length}:layout=${layout.join("|")}:fill=black,scale=${SHEET_WIDTH}:-1`, out])
  console.log(out)
}
