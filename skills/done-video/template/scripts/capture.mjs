// Screenshots a screen of the real product at the size its rebuild fills in the video's browser window,
// as a reference to rebuild against and to compare with (still.mjs --compare). Captures go to out/reference.
//   node scripts/capture.mjs http://localhost:3000/projects --name projects
//   node scripts/capture.mjs https://staging.acme.example/projects/42 --name export-menu --click "text=Export" --wait 400
//   node scripts/capture.mjs https://staging.acme.example --login
// --click (repeatable) clicks a Playwright selector first, to reach a state such as an open menu. --wait is
// milliseconds or a selector to wait for. --scheme dark emulates dark mode. --login opens Chrome for the user
// to sign in themselves; closing the tab saves the session to out/reference/session.json for later captures.
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright-core"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const OUT = join(ROOT, "out/reference")
const SESSION = join(OUT, "session.json")
const stage = JSON.parse(readFileSync(join(ROOT, "src/stage.json"), "utf8"))
const SETTLE_MS = 300
const NETWORK_QUIET_MS = 5000

const args = process.argv.slice(2)
const VALUE_FLAGS = ["--name", "--click", "--wait", "--scheme"]
const values = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []))
const url = args.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1]))
if (!url) {
  console.error("Usage: node scripts/capture.mjs <url> [--name name] [--click selector]… [--wait ms|selector] [--scheme dark] [--login]")
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

// The rebuild is drawn at uiScale times a real browser. A viewport that much smaller, at that device scale,
// lays the page out as a browser would and comes out the same size in pixels as the rebuild.
const content = { w: stage.window.w / stage.uiScale, h: (stage.window.h - stage.titleBar) / stage.uiScale }
const viewport = { width: Math.round(content.w), height: Math.ceil(content.h) }
const storageState = existsSync(SESSION) ? SESSION : undefined

if (args.includes("--login")) {
  const browser = await chromium.launch({ channel: "chrome", headless: false })
  const context = await browser.newContext({ viewport, storageState })
  const page = await context.newPage()
  await page.goto(url)
  console.log("Sign in in the Chrome window, then close its tab (not Chrome itself).")
  await Promise.race([page.waitForEvent("close", { timeout: 0 }), new Promise((resolve) => browser.once("disconnected", resolve))])
  if (!browser.isConnected()) {
    console.error("Chrome was quit before the session could be saved. Run --login again and close just the tab.")
    process.exit(1)
  }
  await context.storageState({ path: SESSION })
  await browser.close()
  console.log(`Saved the session to ${SESSION}. It holds sign-in cookies: keep it out of commits, and delete it when the video is done.`)
  process.exit(0)
}

const name = values("--name")[0] ?? (new URL(url).pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home")
const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({ viewport, deviceScaleFactor: stage.uiScale, colorScheme: values("--scheme")[0] === "dark" ? "dark" : "light", storageState })
const page = await context.newPage()
await page.goto(url, { waitUntil: "load" })
// Single-page apps keep fetching after load; give them a moment to go quiet, but don't wait forever on a socket.
await page.waitForLoadState("networkidle", { timeout: NETWORK_QUIET_MS }).catch(() => {})
await page.evaluate(() => document.fonts.ready)
for (const selector of values("--click")) {
  await page.locator(selector).first().click()
  await page.waitForTimeout(SETTLE_MS)
}
const wait = values("--wait")[0]
if (wait) await (/^\d+$/.test(wait) ? page.waitForTimeout(Number(wait)) : page.locator(wait).first().waitFor())
const file = join(OUT, `${name}.png`)
await page.screenshot({ path: file, clip: { x: 0, y: 0, width: content.w, height: content.h } })
await browser.close()
console.log(file)
