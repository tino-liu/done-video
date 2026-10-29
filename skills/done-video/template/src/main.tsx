import "./styles.css"

import { Pause, Play } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { STAGE_H, STAGE_W } from "./components/Camera"
import { allEvents } from "./scenes"
import { sceneIndexAt, Stage } from "./Stage"
import { applyBrand } from "./lib/brand"
import { FPS, timeline } from "./lib/timeline"

declare global {
  interface Window {
    __ready?: boolean
    __total?: number
    __setFrame?: (n: number) => Promise<void>
    __events?: () => ReturnType<typeof allEvents>
  }
}

const params = new URLSearchParams(location.search)
const IS_RENDER = params.has("render")
const SHOW_CAPTIONS = params.get("captions") !== "0"
const MIX_URL = "/audio/mix.m4a"

/** Resolves once every image on the page has loaded, so a frame is never captured mid-load. */
const imagesLoaded = () =>
  Promise.all(
    [...document.images]
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true })
            img.addEventListener("error", resolve, { once: true })
          })
      )
  )

applyBrand()

/** Headless mode: scripts/render.mjs calls __setFrame(n) and screenshots the stage. */
function RenderApp() {
  const [state, setState] = useState({ frame: Number(params.get("frame") ?? 0), pass: 0 })
  useEffect(() => {
    window.__total = timeline.total
    window.__events = allEvents
    window.__setFrame = async (n: number) => {
      // Two passes: the second reads the DOM the first committed, so cursor and camera targets are right.
      flushSync(() => setState({ frame: n, pass: 0 }))
      flushSync(() => setState({ frame: n, pass: 1 }))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await imagesLoaded()
    }
    document.fonts.ready.then(async () => {
      await window.__setFrame?.(Number(params.get("frame") ?? 0))
      window.__ready = true
    })
  }, [])
  return <Stage frame={state.frame} pass={state.pass} captions={SHOW_CAPTIONS} />
}

const fmt = (frame: number) => {
  const s = frame / FPS
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`
}

/** Preview: scaled stage, scrubber, and the mixed audio once `npm run mix` has made it. */
function Player() {
  const [frame, setFrame] = useState(Number(params.get("frame") ?? 0))
  const [pass, setPass] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [scale, setScale] = useState(0.5)
  const audio = useRef<HTMLAudioElement>(null)
  const clock = useRef({ t0: 0, f0: 0 })

  useEffect(() => {
    fetch(MIX_URL, { method: "HEAD" }).then((r) => setHasAudio(r.ok && (r.headers.get("content-type") ?? "").includes("audio")))
    const fit = () => setScale(Math.min((window.innerWidth - 48) / STAGE_W, (window.innerHeight - 150) / STAGE_H))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  // After a jump, render once more so measured targets are read from the committed DOM.
  useEffect(() => {
    const id = requestAnimationFrame(() => setPass((p) => p + 1))
    return () => cancelAnimationFrame(id)
  }, [frame])

  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => {
      const next = hasAudio && audio.current ? Math.floor(audio.current.currentTime * FPS) : clock.current.f0 + Math.floor(((performance.now() - clock.current.t0) / 1000) * FPS)
      if (next >= timeline.total) {
        setPlaying(false)
        return
      }
      setFrame(next)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing, hasAudio])

  const seek = useCallback(
    (n: number) => {
      const f = Math.max(0, Math.min(timeline.total - 1, n))
      setFrame(f)
      clock.current = { t0: performance.now(), f0: f }
      if (audio.current) audio.current.currentTime = f / FPS
    },
    []
  )

  const toggle = useCallback(() => {
    setPlaying((p) => {
      const next = !p
      clock.current = { t0: performance.now(), f0: frame }
      if (audio.current && hasAudio) {
        audio.current.currentTime = frame / FPS
        if (next) audio.current.play()
        else audio.current.pause()
      }
      return next
    })
  }, [frame, hasAudio])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        toggle()
      }
      if (e.code === "ArrowRight") seek(frame + (e.shiftKey ? 1 : FPS))
      if (e.code === "ArrowLeft") seek(frame - (e.shiftKey ? 1 : FPS))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle, seek, frame])

  const current = timeline.scenes[sceneIndexAt(frame)]

  return (
    <div className="flex min-h-screen flex-col items-center gap-3 p-6" style={{ fontSize: 14 }}>
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, borderRadius: 10, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <Stage frame={frame} pass={pass} captions={SHOW_CAPTIONS} />
        </div>
      </div>
      <div className="flex w-full items-center gap-3" style={{ maxWidth: STAGE_W * scale }}>
        <button onClick={toggle} className="bg-accent flex items-center justify-center rounded-full text-white" style={{ width: 38, height: 38 }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input type="range" min={0} max={timeline.total - 1} value={frame} onChange={(e) => seek(Number(e.target.value))} className="flex-1 accent-(--color-accent)" />
        <span className="font-mono text-[#aaa]">
          {fmt(frame)} / {fmt(timeline.total)} · f{frame} · {current.id}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" style={{ maxWidth: STAGE_W * scale }}>
        {timeline.scenes.map((s) => (
          <button key={s.id} onClick={() => seek(s.start)} className="rounded-md border border-[#444] px-2 py-1 text-[#ddd]" style={{ background: s.id === current.id ? "var(--color-accent)" : "#222" }}>
            {s.id}
          </button>
        ))}
        <span className="text-[#888]">voice: {timeline.voice} · {hasAudio ? "mixed audio" : "silent (run npm run mix)"}</span>
      </div>
      {hasAudio && <audio ref={audio} src={MIX_URL} preload="auto" />}
    </div>
  )
}

createRoot(document.getElementById("root")!).render(IS_RENDER ? <RenderApp /> : <Player />)
