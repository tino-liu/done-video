// The example product, "Acme Tasks". Replace this file with the real product's screens, rebuilt from
// its own components and styles, with fictional demo data.
import { CalendarDays, Download, FileSpreadsheet, Filter, FolderKanban, Inbox, ListChecks, PieChart, Plus, Settings } from "lucide-react"
import type { ComponentType, ReactNode } from "react"

import { brand } from "../lib/brand"
import { Button } from "./kit"

type IconType = ComponentType<{ size?: number; className?: string }>

const NAV: Array<{ label: string; icon: IconType }> = [
  { label: "Inbox", icon: Inbox },
  { label: "My tasks", icon: ListChecks },
  { label: "Projects", icon: FolderKanban },
  { label: "Reports", icon: PieChart },
  { label: "Settings", icon: Settings },
]

export function AppShell({ active, crumb, children }: { active: string; crumb: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-app-bg text-app-fg absolute inset-0 flex">
      <aside className="bg-app-side border-app-border flex w-60 shrink-0 flex-col border-r px-3 pt-4">
        <div className="flex items-center gap-2 px-2 pb-6">
          <img src={brand.logo} style={{ width: 30 }} />
          <span className="text-[1rem] font-bold tracking-tight">{brand.name}</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon }) => (
            <div key={label} data-t={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`} className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.8rem] ${label === active ? "bg-app-bg font-semibold shadow-sm" : "text-app-mfg"}`}>
              <Icon size={16} className={label === active ? "text-app-brand" : ""} />
              {label}
            </div>
          ))}
        </nav>
      </aside>
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="border-app-border flex h-14 shrink-0 items-center border-b px-6 text-[0.75rem]">{crumb}</header>
        <div className="relative flex-1 overflow-hidden p-6">{children}</div>
      </main>
    </div>
  )
}

export const PROJECTS = [
  { name: "Website relaunch", tasks: 12, done: 7 },
  { name: "Mobile app v2", tasks: 31, done: 18 },
  { name: "Q3 marketing", tasks: 9, done: 2 },
]

export function ProjectsGrid({ pressedName }: { pressedName?: string }) {
  return (
    <div>
      <h1 className="text-[1.2rem] font-bold">Projects</h1>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {PROJECTS.map((p) => (
          <div
            key={p.name}
            data-t={`project-${p.name}`}
            className="border-app-border rounded-lg border p-4"
            style={{ transform: p.name === pressedName ? "scale(0.97)" : undefined, background: p.name === pressedName ? "var(--color-app-side)" : undefined }}
          >
            <div className="text-[0.85rem] font-semibold">{p.name}</div>
            <div className="text-app-mfg mt-1 text-[0.65rem]">
              {p.done} of {p.tasks} tasks done
            </div>
            <div className="bg-app-side mt-3 h-1.5 overflow-hidden rounded-full">
              <div className="bg-app-brand h-full" style={{ width: `${(p.done / p.tasks) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const TASKS = [
  ["Design the new homepage hero", "Priya N.", "12 Nov", "In progress"],
  ["Write copy for the pricing page", "Sam K.", "14 Nov", "To do"],
  ["Set up redirects from old URLs", "Jordan L.", "15 Nov", "To do"],
  ["Compress product images", "Alex D.", "18 Nov", "Done"],
  ["Accessibility audit", "Mia W.", "20 Nov", "In progress"],
  ["Launch checklist", "Alex D.", "25 Nov", "To do"],
]

const STATUS_LOOK: Record<string, string> = {
  Done: "bg-green-100 text-green-800",
  "In progress": "bg-blue-100 text-blue-800",
  "To do": "bg-gray-100 text-gray-700",
}

const COLUMNS = "46% 18% 16% 20%"

/** The project's task list with its toolbar. `toolbarEnd` is drawn at the right of the toolbar, e.g. a download chip. */
export function TasksView({ exportPressed, menu, toolbarEnd }: { exportPressed?: boolean; menu?: ReactNode; toolbarEnd?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[1.2rem] font-bold">Website relaunch</h1>
        <div className="flex items-center gap-2">
          {toolbarEnd}
          <Button variant="outline">
            <Filter size={14} /> Filter
          </Button>
          <div className="relative z-30">
            <Button variant="outline" target="export-btn" pressedNow={exportPressed}>
              <Download size={14} /> Export
            </Button>
            {menu}
          </div>
          <Button>
            <Plus size={14} /> New task
          </Button>
        </div>
      </div>
      <div data-t="task-table" className="border-app-border mt-5 overflow-hidden rounded-lg border">
        <div className="text-app-mfg bg-app-side grid px-4 py-2.5 text-[0.65rem] font-medium" style={{ gridTemplateColumns: COLUMNS }}>
          <span data-t="col-task">Task</span>
          <span data-t="col-owner" className="w-fit">
            Owner
          </span>
          <span data-t="col-due" className="flex w-fit items-center gap-1">
            <CalendarDays size={12} /> Due
          </span>
          <span>Status</span>
        </div>
        {TASKS.map(([task, owner, due, status]) => (
          <div key={task} className="border-app-border grid items-center border-t px-4 py-3 text-[0.72rem]" style={{ gridTemplateColumns: COLUMNS }}>
            <span className="font-medium">{task}</span>
            <span>{owner}</span>
            <span>{due}</span>
            <span className={`w-fit rounded-full px-2 py-0.5 text-[0.6rem] font-medium ${STATUS_LOOK[status]}`}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The browser's download chip that appears once the export finishes. */
export function DownloadChip({ opacity }: { opacity: number }) {
  return (
    <div data-t="download-chip" className="border-app-border flex h-9 items-center gap-2 rounded-md border px-3 text-[0.7rem]" style={{ opacity, transform: `translateY(${(1 - opacity) * -6}px)` }}>
      <FileSpreadsheet size={15} className="text-green-700" />
      <span className="font-medium">website-relaunch-tasks.csv</span>
      <span className="text-app-mfg">2 KB</span>
    </div>
  )
}
