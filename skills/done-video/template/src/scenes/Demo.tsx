import { BrowserWindow } from "../components/BrowserWindow"
import { Callout, Highlight } from "../components/Callout"
import { Camera } from "../components/Camera"
import type { CamKey } from "../components/Camera"
import { Cursor, clickFrames, pressed } from "../components/Cursor"
import type { CursorKey } from "../components/Cursor"
import { enter, interp } from "../lib/anim"
import type { Helpers } from "../lib/timeline"
import { AppShell, DownloadChip, ProjectsGrid, TASKS, TasksView } from "../ui/app"
import { Menu, Toast } from "../ui/kit"
import type { SceneDef, SceneProps } from "./types"

const PROJECT = "Website relaunch"
const FORMATS = [{ label: "CSV" }, { label: "Excel", note: "Coming soon", disabled: true }, { label: "PDF" }]
const VIEW_SWAP = 6

/** When everything happens, in scene frames, cued to the spoken words. */
function beats(h: Helpers) {
  const projectClick = h.cue("project") + 2
  const tasks = projectClick + 4
  const exportClick = Math.max(h.cue("Export") + 2, tasks + 24)
  const menuOpen = exportClick + 2
  const csvPick = Math.max(h.cue("CSV") + 4, menuOpen + 16)
  const download = Math.max(h.cue("downloads") - 2, csvPick + 8)
  return { projectClick, tasks, exportClick, menuOpen, csvPick, download, every: h.cue("every"), owner: h.cue("owner"), due: h.cue("due") }
}

type Beats = ReturnType<typeof beats>

const cursorKeys = (b: Beats): CursorKey[] => [
  { at: b.projectClick, target: `project-${PROJECT}`, click: true, dur: 22 },
  { at: b.exportClick, target: "export-btn", click: true, dur: 22 },
  { at: b.csvPick, target: "export-opt-CSV", dx: -40, click: true, dur: 14 },
  // Out of the way of the table while the columns are pointed out.
  { at: b.every + 12, target: "task-table", dx: 520, dy: 260, dur: 30 },
]

const camKeys = (b: Beats): CamKey[] => [
  { at: b.projectClick - 18, target: `project-${PROJECT}`, scale: 1.3, dur: 20 },
  { at: b.tasks + 2, x: 960, y: 540, scale: 1, dur: 22 },
  { at: b.exportClick - 16, target: "export-btn", scale: 1.6, dx: -160, dy: 90, dur: 22 },
  { at: b.download + 14, target: "task-table", scale: 1.15, dy: -30, dur: 28 },
]

function Demo({ f, h }: SceneProps) {
  const b = beats(h)
  const grid = interp(f, [b.tasks, b.tasks + VIEW_SWAP], [1, 0])
  return (
    <Camera f={f} keys={camKeys(b)}>
      <BrowserWindow url={f < b.tasks ? "app.acme.example/projects" : "app.acme.example/projects/website-relaunch"} theme="light">
        <AppShell active="Projects" crumb={f < b.tasks ? "Projects" : `Projects  ›  ${PROJECT}`}>
          {/* Both views stay mounted, so every camera and cursor target can be measured on every frame. */}
          <div className="absolute inset-0 p-6" style={{ opacity: grid, visibility: grid > 0 ? "visible" : "hidden" }}>
            <ProjectsGrid pressedName={pressed(f, b.projectClick) ? PROJECT : undefined} />
          </div>
          <div className="absolute inset-0 p-6" style={{ opacity: 1 - grid }}>
            <TasksView
              exportPressed={pressed(f, b.exportClick)}
              menu={<Menu f={f} options={FORMATS} openAt={b.menuOpen} closeAt={b.csvPick + 2} highlighted={f >= b.csvPick - 8 ? "CSV" : undefined} optionTarget={(l) => `export-opt-${l}`} className="top-10 right-0 w-48" />}
              toolbarEnd={<DownloadChip opacity={enter(f, b.download, 10)} />}
            />
          </div>
          <Toast f={f} at={b.download + 4} hold={90}>
            Exported {TASKS.length} tasks to CSV
          </Toast>
        </AppShell>
      </BrowserWindow>
      <Callout f={f} at={b.download + 8} until={b.every + 4} target="download-chip" side="bottom">
        Downloads straight away
      </Callout>
      <Highlight f={f} at={b.owner} until={b.due - 2} target="col-owner" />
      <Highlight f={f} at={b.due} until={h.dur - 12} target="col-due" />
      <Cursor f={f} keys={cursorKeys(b)} start={{ x: 1300, y: 820 }} />
    </Camera>
  )
}

export const demo: SceneDef = {
  Component: Demo,
  events: (h) => {
    const b = beats(h)
    return [...clickFrames(cursorKeys(b)).map((at) => ({ at, type: "click" as const })), { at: b.download + 4, type: "success" }]
  },
}
