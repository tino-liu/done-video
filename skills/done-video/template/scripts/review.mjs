// Goes through a rendered video from its first frame to its last and lists what's wrong with it, so it
// can be fixed before anyone sees it. It checks that the video is up to date, whole and rendered
// without page errors; the sound's loudness, peaks and ending; each line of the voice for a stray sound
// after its last word or a cut-off end; and the picture for one-frame glitches, empty frames and jumps.
// It also draws a contact sheet of each scene into out/review/: frames through the scene, each labelled
// with its time and the words being spoken, above a spectrogram of the scene's sound.
//   npm run review                      (the video named in video.config.json)
//   npm run review -- out/done-video-paper.mp4
// Prints problems, which need fixing, and things to look at on the sheets. Exits 1 if there are problems.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { chromium } from "playwright-core"

import { decode, levels, RATE, speechEnd, strayPauses } from "./sound.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const OUT = join(ROOT, "out/review")
const timeline = JSON.parse(readFileSync(join(ROOT, "src/timeline.json"), "utf8"))
const FPS = timeline.fps
const { output } = JSON.parse(readFileSync(join(ROOT, "video.config.json"), "utf8"))
const video = resolve(process.argv[2] ?? join(ROOT, "out", output))
const name = relative(ROOT, video)
if (!existsSync(video)) {
  console.error(`No ${name}. Render it with npm run render first.`)
  process.exit(1)
}

/** Fix these. */
const problems = []
/** Look at these on the sheets; fix the ones that are wrong. */
const looks = []
const note = (list, frame, text) => list.push({ frame, text })

const clock = (frame) => {
  const s = frame / FPS
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`
}
const sceneAt = (frame) => timeline.scenes.find((s) => frame < s.start + s.duration) ?? timeline.scenes.at(-1)
const ff = (args) => spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 }).stderr

// ---------- up to date and whole ----------

/** The most recently changed file under these paths. */
function newest(paths, skip = []) {
  let best = null
  const visit = (path) => {
    if (!existsSync(path) || skip.includes(path)) return
    const stat = statSync(path)
    if (stat.isDirectory()) return readdirSync(path).forEach((f) => visit(join(path, f)))
    if (!best || stat.mtimeMs > best.mtime) best = { file: relative(ROOT, path), mtime: stat.mtimeMs }
  }
  paths.forEach(visit)
  return best
}
const at = (file) => (existsSync(join(ROOT, file)) ? statSync(join(ROOT, file)).mtimeMs : 0)
const mixInputs = newest([join(ROOT, "src"), join(ROOT, "public/audio/voice"), join(ROOT, "public/audio/music.mp3")])
const renderInputs = newest([join(ROOT, "src"), join(ROOT, "public"), join(ROOT, "video.config.json"), join(ROOT, "out/mix.wav")], [join(ROOT, "public/audio/mix.m4a")])
if (at("scripts/scenes.mjs") > at("src/timeline.json")) note(problems, null, "scripts/scenes.mjs changed after the voice was made: run npm run voice, then mix and render.")
if (!existsSync(join(ROOT, "out/mix.wav"))) note(problems, null, "There is no mix: run npm run mix, then render.")
else if (mixInputs.mtime > at("out/mix.wav")) note(problems, null, `${mixInputs.file} changed after the mix: run npm run mix, then render.`)
if (renderInputs.mtime > statSync(video).mtimeMs) note(problems, null, `${renderInputs.file} changed after ${name} was rendered: render it again.`)

const log = video.replace(/\.mp4$/, ".render.json")
if (existsSync(log)) {
  const { errors, warnings } = JSON.parse(readFileSync(log, "utf8"))
  for (const e of errors) note(problems, null, `The page threw while rendering: ${e}`)
  for (const w of warnings) note(problems, null, `The page warned while rendering: ${w}`)
} else {
  note(looks, null, `No ${relative(ROOT, log)}, so page errors during the render weren't checked. Render with npm run render to get one.`)
}

const streams = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", video], { encoding: "utf8" })).streams
const audioStream = streams.find((s) => s.codec_type === "audio")
const videoSeconds = Number(streams.find((s) => s.codec_type === "video").duration)
/** AAC writes sound in blocks of 1024 samples, so the soundtrack may end a block either side of the picture. */
const SYNC_SLACK = 0.05
if (!audioStream) note(problems, null, "The video has no sound: run npm run mix, then render again.")
else if (Math.abs(Number(audioStream.duration) - videoSeconds) > SYNC_SLACK) note(problems, null, `The sound runs ${Number(audioStream.duration).toFixed(2)}s and the picture ${videoSeconds.toFixed(2)}s: mix and render again.`)

// ---------- the sound ----------

const TARGET_LUFS = -16
const LUFS_SLACK = 1
const MAX_TRUE_PEAK = -1
/** Quieter than this, a sound can't be heard: the soundtrack has faded out, or a line has. */
const SILENT_DB = -60
/** The stretch at the very end that must already be silent. */
const LAST_MOMENT = 0.1

if (audioStream) {
  const report = ff(["-i", video, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"])
  const lufs = Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1])
  const peak = Number([...report.matchAll(/Peak:\s+(-?[\d.inf]+) dBFS/g)].pop()?.[1])
  if (Math.abs(lufs - TARGET_LUFS) > LUFS_SLACK) note(problems, null, `The soundtrack is ${lufs} LUFS; it should be ${TARGET_LUFS} ±${LUFS_SLACK}. Mix again.`)
  if (peak > MAX_TRUE_PEAK) note(problems, null, `The soundtrack peaks at ${peak} dBTP, over ${MAX_TRUE_PEAK}: it will distort on some players. Mix again.`)
  const sound = decode(video)
  const tail = levels(sound.subarray(sound.length - Math.round(LAST_MOMENT * RATE)))
  if (Math.max(...tail) > SILENT_DB) note(problems, timeline.total - 1, "The sound is still playing at the last frame, so it cuts off rather than fading out. Mix again.")
}

/** By this long after a line's speech ends, the mix has faded it to silence. */
const LINE_RELEASE = 0.25
const stemFile = join(ROOT, "out/stem-voice.wav")
const timed = timeline.voice === "elevenlabs"
if (existsSync(stemFile)) {
  const stem = decode(stemFile)
  timeline.scenes.forEach((s, i) => {
    const words = s.words
    if (!words.length) return
    const start = (s.start + s.lead) / FPS
    const next = timeline.scenes[i + 1]
    const stop = next ? (next.start + next.lead) / FPS : timeline.total / FPS
    const line = stem.subarray(Math.round(start * RATE), Math.round(stop * RATE))
    const frameOf = (t) => s.start + s.lead + Math.round(t * FPS)
    const last = words.at(-1)
    const { end, loud } = speechEnd(line, last.s)
    if (end === null) note(problems, frameOf(last.s), `The "${s.id}" line is still sounding when ${next ? "the next one starts" : "the video ends"}.`)
    else if (Math.max(-Infinity, ...levels(line.subarray(Math.round((end + LINE_RELEASE) * RATE)))) > SILENT_DB) {
      note(problems, frameOf(end + LINE_RELEASE), `In "${s.id}", sound carries on after the last word ("${last.w}"): static, hiss or a stray sound. Mix again; if it stays, re-roll the line (npm run voice -- --reroll=${s.id}).`)
    }
    if (loud !== null) note(looks, frameOf(loud), `In "${s.id}", a sound that could be a word ${(loud - last.s).toFixed(1)}s after the last word ("${last.w}"). Check the spectrogram: if it isn't the end of the line, re-roll the line (npm run voice -- --reroll=${s.id}).`)
    if (speechEnd(decode(join(ROOT, "public", s.audio)), last.s).end === null) note(looks, frameOf(last.s), `The "${s.id}" clip is still sounding where it ends, so the voice may have cut off its last word ("${last.w}"). If it did, re-roll the line.`)
    if (timed) for (const p of strayPauses(line, words)) note(problems, frameOf(p.from), `A stray sound in "${s.id}" between "${p.after}" and "${p.before}". Mix again; if it stays, re-roll the line.`)
  })
} else {
  note(problems, null, "There is no out/stem-voice.wav: run npm run mix, then render.")
}

// ---------- the picture ----------

/** The picture is compared at this size, in grey: enough to see a layout change, quick to read. */
const PROBE = { w: 160, h: 90 }
/** Mean change in grey level (0–255) between frames that counts as the picture changing. */
const CHANGE = 3
/** A change this big in one frame, with little change either side, is a cut. */
const CUT = 10
/** The frames either side of a cut change less than this share of it. */
const CUT_ISOLATION = 0.25
/** A frame whose grey levels vary less than this is one flat colour. */
const FLAT = 1.5
/** The last scene fades out over about this long, so flat frames there are expected. */
const FADE_OUT = 1
/** A dip fades through the backdrop over 18 frames (src/Stage.tsx), which can be flat. */
const DIP_FRAMES = 18

const size = PROBE.w * PROBE.h
const pixels = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${PROBE.w}:${PROBE.h}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1024 * 1024 * 1024 })
const count = pixels.length / size
const frame = (n) => pixels.subarray(n * size, (n + 1) * size)
const change = (a, b) => {
  let sum = 0
  for (let k = 0; k < size; k++) sum += Math.abs(a[k] - b[k])
  return sum / size
}
const spread = (a) => {
  const mean = a.reduce((s, v) => s + v, 0) / size
  return Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / size)
}
if (count !== timeline.total) note(problems, null, `${name} has ${count} frames, but the timeline has ${timeline.total}. Render the whole video again.`)

const diffs = [0]
for (let n = 1; n < count; n++) diffs.push(change(frame(n - 1), frame(n)))
let flatFrom = null
for (let n = 0; n < count; n++) {
  const s = sceneAt(n)
  const local = n - s.start
  if (n > 0 && n + 1 < count) {
    const step = Math.min(diffs[n], diffs[n + 1])
    if (step > CHANGE && change(frame(n - 1), frame(n + 1)) < step * CUT_ISOLATION) note(problems, n, `Frame ${n} in "${s.id}" differs from the frames either side of it, which match each other: a one-frame glitch.`)
    else if (diffs[n] > CUT && Math.max(diffs[n - 1], diffs[n + 1]) < diffs[n] * CUT_ISOLATION && !(local === 0 && s.transition === "none")) note(looks, n, `In "${s.id}", the picture changes all at once at frame ${n}. A new page or a menu opening can; the camera or a layout jumping can't.`)
  }
  const flat = spread(frame(n)) < FLAT && !(s.transition === "dip" && local < DIP_FRAMES && n > 0) && n < count - FADE_OUT * FPS
  if (flat && flatFrom === null) flatFrom = n
  if (!flat && flatFrom !== null) {
    note(looks, flatFrom, `${n - flatFrom === 1 ? `Frame ${flatFrom} is` : `Frames ${flatFrom}–${n - 1} are`} one flat colour in "${sceneAt(flatFrom).id}". Fine while a card fades in; wrong if a scene is missing.`)
    flatFrom = null
  }
}

// ---------- contact sheets ----------

/** A moment after a scene's transition has finished. */
const SETTLED = 0.8
/** Into a crossfade, where both scenes show. */
const MID_FADE = 0.23
/** After a click or other sound effect, when its result shows. */
const AFTER_EVENT = 4
/** No two frames on a sheet further apart than this. */
const MAX_GAP = 1.5
/** Nor closer than this, unless something was found there. */
const MIN_APART = 0.3
const COLUMNS = 3
const TILES_PER_SHEET = 9
const TILE_W = 624
const SPACE = 12
const SHEET_W = COLUMNS * TILE_W + (COLUMNS + 1) * SPACE

const events = existsSync(join(ROOT, "out/events.json")) ? JSON.parse(readFileSync(join(ROOT, "out/events.json"), "utf8")) : []
// Where a frame has both, the problem wins.
const flagged = new Map([...looks.map((x) => [x.frame, "look"]), ...problems.map((x) => [x.frame, "problem"])].filter(([n]) => n !== null))

/** Frames to show for a scene, each with why it was picked. */
function picks(s) {
  const end = s.start + s.duration - 1
  const want = new Map()
  const add = (n, why) => n >= s.start && n <= end && n < count && !want.has(n) && want.set(n, why)
  for (const [n, kind] of flagged) {
    if (sceneAt(n) !== s) continue
    add(n, kind)
    add(n - 1, "before")
  }
  if (s.transition === "fade" && s.start > 0) add(s.start + Math.round(MID_FADE * FPS), "crossfade")
  add(s.start + Math.round(SETTLED * FPS), "settled")
  for (const e of events) if (sceneAt(e.at) === s) add(e.at + AFTER_EVENT, e.type)
  add(end, "end")
  const sorted = [...want.keys()].sort((a, b) => a - b)
  const kept = []
  for (const n of sorted) if (!kept.length || ["problem", "look", "before"].includes(want.get(n)) || n - kept.at(-1) >= MIN_APART * FPS) kept.push(n)
  // Fill long stretches with evenly spaced frames.
  const filled = []
  kept.forEach((n, i) => {
    filled.push(n)
    const gap = (kept[i + 1] ?? n) - n
    const parts = Math.ceil(gap / (MAX_GAP * FPS))
    for (let k = 1; k < parts; k++) filled.push(n + Math.round((k * gap) / parts))
  })
  return filled.map((n) => ({ n, why: want.get(n) ?? "" }))
}

/** The words being spoken at a frame, with the one being said marked. */
function spoken(s, n) {
  const t = (n - s.start - s.lead) / FPS
  if (!s.words.length || t < s.words[0].s - 0.2) return "(before the line)"
  if (t > s.words.at(-1).e + 0.3) return "(after the line)"
  let i = s.words.findIndex((w) => t < w.s)
  i = i < 0 ? s.words.length - 1 : Math.max(0, i - 1)
  return s.words.map((w, k) => (k === i ? `<b>${w.w}</b>` : w.w)).slice(Math.max(0, i - 3), i + 4).join(" ")
}

const escape = (text) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const all = timeline.scenes.flatMap((s) => picks(s).map((p) => ({ ...p, s })))
const numbers = [...new Set(all.map((p) => p.n))].sort((a, b) => a - b)
execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `select='${numbers.map((n) => `eq(n\\,${n})`).join("+")}',scale=${TILE_W}:-2`, "-fps_mode", "passthrough", "-q:v", "3", join(OUT, "f%04d.jpg")])
const tileOf = new Map(numbers.map((n, i) => [n, `f${String(i + 1).padStart(4, "0")}.jpg`]))

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: SHEET_W, height: 800 } })
const sheets = []
for (const [i, s] of timeline.scenes.entries()) {
  const from = s.start / FPS
  const seconds = s.duration / FPS
  execFileSync("ffmpeg", ["-v", "error", "-ss", String(from), "-t", String(seconds), "-i", video, "-lavfi", `showspectrumpic=s=${SHEET_W - 2 * SPACE}x180:legend=0:scale=log:color=intensity`, join(OUT, `sound-${s.id}.png`)])
  const scenePicks = all.filter((p) => p.s === s)
  for (let part = 0; part * TILES_PER_SHEET < scenePicks.length; part++) {
    const tiles = scenePicks.slice(part * TILES_PER_SHEET, (part + 1) * TILES_PER_SHEET)
    const marks = s.words.map((w) => `<span style="left:${(((s.lead / FPS + w.s) / seconds) * 100).toFixed(2)}%">${escape(w.w)}</span>`).join("")
    const flags = [...flagged.keys()].filter((n) => sceneAt(n) === s).map((n) => `<i class="${flagged.get(n)}" style="left:${(((n - s.start) / s.duration) * 100).toFixed(2)}%"></i>`).join("")
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: ${SPACE}px; background: #111; color: #ddd; font: 15px/1.35 system-ui, sans-serif; width: ${SHEET_W - 2 * SPACE}px }
      h1 { font-size: 20px; margin: 0 0 4px } p { margin: 0 0 10px; color: #aaa }
      .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${TILE_W}px); gap: ${SPACE}px }
      .tile { border: 3px solid transparent } .problem { border-color: #ff4d4f } .look { border-color: #ffb020 }
      .tile img { display: block; width: 100% } .cap { padding: 4px 6px; background: #222; min-height: 40px } .cap b { color: #fff; background: #3a5bd9; padding: 0 3px }
      .sound { position: relative; margin-top: 14px } .sound img { display: block; width: 100%; height: 180px }
      .words { position: relative; height: 22px } .words span { position: absolute; font-size: 12px; white-space: nowrap; border-left: 1px solid #888; padding-left: 2px }
      .sound i { position: absolute; top: 0; bottom: 0; width: 3px; background: #ffb020 } .sound i.problem { background: #ff4d4f }
    </style>
    <h1>${i + 1}. ${s.id} · ${clock(s.start)}–${clock(s.start + s.duration)}${part ? ` · continued` : ""}</h1><p>${escape(s.text)}</p>
    <div class="grid">${tiles.map((t) => `<div class="tile ${["problem", "look"].includes(t.why) ? t.why : ""}"><img src="${tileOf.get(t.n)}"><div class="cap">${clock(t.n)} · frame ${t.n}${t.why ? ` · ${t.why}` : ""}<br>${spoken(s, t.n)}</div></div>`).join("")}</div>
    ${part ? "" : `<div class="sound"><div class="words">${marks}</div><img src="sound-${s.id}.png">${flags}</div>`}`
    const file = join(OUT, `${String(i + 1).padStart(2, "0")}-${s.id}${part ? `-${part + 1}` : ""}`)
    writeFileSync(`${file}.html`, html)
    await page.goto(pathToFileURL(`${file}.html`).href)
    await page.screenshot({ path: `${file}.png`, fullPage: true })
    sheets.push(relative(ROOT, `${file}.png`))
  }
}
await browser.close()

// ---------- report ----------

const byTime = (a, b) => (a.frame ?? -1) - (b.frame ?? -1)
problems.sort(byTime)
looks.sort(byTime)
const line = ({ frame, text }) => `  ${frame === null ? "      " : clock(frame).padStart(6)}  ${text}`
console.log(`Review of ${name}: ${clock(timeline.total)}, ${timeline.scenes.length} scenes\n`)
console.log(problems.length ? `Problems (${problems.length}). Fix each, then mix, render and review again:\n${problems.map(line).join("\n")}\n` : "No problems found.\n")
if (looks.length) console.log(`Look at these on the sheets, and fix any that are wrong:\n${looks.map(line).join("\n")}\n`)
console.log(`Sheets, one or more per scene. Look through every one against references/review.md:\n${sheets.map((s) => `  ${s}`).join("\n")}`)
process.exit(problems.length ? 1 : 0)
