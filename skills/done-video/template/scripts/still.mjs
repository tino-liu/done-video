// Renders individual frames to PNG for checking a scene without rendering the whole video.
//   node scripts/still.mjs 120 400 2.5s demo+3s
//   node scripts/still.mjs --sheet intro+2s title+1s demo+4s outro+3s
//   node scripts/still.mjs --sheet --theme aurora,paper title+2s demo+4s
//   node scripts/still.mjs --compare projects demo+1s
// A number is a frame; "2.5s" is seconds; "scene+3s" is seconds into a scene. Output goes to
// out/stills; --sheet also tiles them, two across, into out/stills/sheet.png. --theme renders the
// frames in each named theme from src/themes/, and the sheet gives each theme a row. --compare puts
// the browser window's contents beside a capture from capture.mjs, out/reference/<name>.png, with the
// camera held at home and no captions, and lays the two over each other below.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"
import { build, preview } from "vite"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const OUT = join(ROOT, "out/stills")
const PORT = 5183
const SHEET_COLUMNS = 2
const TILE_WIDTH = 800
const REFERENCE = join(ROOT, "out/reference")
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))
const stage = JSON.parse(readFileSync(join(ROOT, "src/stage.json"), "utf8"))

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
const VALUE_FLAGS = ["--theme", "--compare"]
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const sheet = args.includes("--sheet")
const themes = value("--theme")?.split(",") ?? [null]
const reference = value("--compare")
const frames = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1])).map(toFrame)
const columns = themes.length > 1 ? frames.length : SHEET_COLUMNS
const referenceFile = reference && join(REFERENCE, `${reference}.png`)
if (referenceFile && !existsSync(referenceFile)) {
  console.error(`No ${referenceFile}. Capture it with scripts/capture.mjs, or put the user's screenshot there.`)
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

await build({ root: ROOT, logLevel: "warn" })
const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "warn" })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
page.on("console", (msg) => ["error", "warning"].includes(msg.type()) && console.log("[page]", msg.text()))
page.on("pageerror", (err) => console.log("[page error]", err.message))
const files = []
for (const theme of themes) {
  if (theme) console.log(`theme ${theme}`)
  // An error before the first frame, such as a bad theme, means the page will never be ready.
  const failed = new Promise((resolve) => page.once("pageerror", () => resolve(false)))
  await page.goto(`http://localhost:${PORT}/?render${theme ? `&theme=${encodeURIComponent(theme)}` : ""}${reference ? "&home&captions=0" : ""}`)
  const ready = page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).then(() => true)
  if (!(await Promise.race([ready, failed]))) {
    await browser.close()
    process.exit(1)
  }
  for (const frame of frames) {
    await page.evaluate((n) => window.__setFrame(n), frame)
    const file = join(OUT, `${theme ? `${theme}-` : ""}f${String(frame).padStart(5, "0")}.png`)
    await page.screenshot({ path: file })
    files.push(file)
    console.log(file)
  }
}

await browser.close()
server.httpServer.close()

if (sheet && files.length > 1) {
  // xstack places each tile by the widths and heights of the tiles before it: w0 = one tile across.
  const layout = files.map((_, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = col === 0 ? "0" : Array(col).fill("w0").join("+")
    const y = row === 0 ? "0" : Array(row).fill("h0").join("+")
    return `${x}_${y}`
  })
  const out = join(OUT, "sheet.png")
  execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", `xstack=inputs=${files.length}:layout=${layout.join("|")}:fill=black,scale=${Math.min(columns, files.length) * TILE_WIDTH}:-1`, out])
  console.log(out)
}

if (referenceFile) {
  // The window's contents at home, the size a capture comes out: see scripts/capture.mjs.
  const w = stage.window.w
  const h = stage.window.h - stage.titleBar
  const x = stage.window.x
  const y = stage.window.y + stage.titleBar
  for (const file of files) {
    const out = join(REFERENCE, `${reference}-vs-${basename(file)}`)
    const graph = [
      // A screenshot of another size is scaled to the window's width and cropped or padded to its height.
      `[0]scale=${w}:-2,crop=${w}:'min(ih,${h})':0:0,pad=${w}:${h}:0:0:white,format=rgb24,split[real1][real2]`,
      `[1]crop=${w}:${h}:${x}:${y},format=rgb24,split[rebuilt1][rebuilt2]`,
      `[real1][rebuilt1]hstack,scale=${w}:-2[pair]`,
      `[real2][rebuilt2]blend=all_mode=average[overlay]`,
      `[pair][overlay]vstack`,
    ].join(";")
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", referenceFile, "-i", file, "-filter_complex", graph, out])
    console.log(out)
  }
}
