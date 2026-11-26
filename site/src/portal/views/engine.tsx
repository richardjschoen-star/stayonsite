import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { RiAddLine, RiArrowUpDownLine, RiBookmarkLine, RiCloseLine, RiFilter3Line, RiLayoutRowLine } from "@remixicon/react";
import { useState } from "react";
import { LABELS, PRIOS, STATUSES } from "../constants";
import { Pick, type Option } from "../overlays/pickers";
import { saveViewModal } from "../overlays/modals";
import { isOver, openProjects, personOf, projectOf, taskKey } from "../store";
import type { Filter, Snapshot, Task } from "../types";
import { PersonAvatar, PriorityIcon, ProjectIcon, SearchField, StatusIcon, dayDiff } from "../ui";

/**
 * gr8r's view engine: filters, sort, group and search over tasks, remembered
 * per view in localStorage (prefs stay in the browser, as in gr8r).
 */

export interface ViewState {
  filters: Filter[];
  sort: { f: string; dir: 1 | -1 };
  group: string;
  q: string;
  showDone: boolean;
}

const DEFAULTS: ViewState = { filters: [], sort: { f: "manual", dir: 1 }, group: "status", q: "", showDone: true };

export function useView(key: string, initial: Partial<ViewState> = {}) {
  const [v, setV] = useState<ViewState>(() => {
    try {
      return { ...DEFAULTS, ...initial, ...JSON.parse(localStorage.getItem(`console:view:${key}`) ?? "{}") };
    } catch {
      return { ...DEFAULTS, ...initial };
    }
  });
  const update = (patch: Partial<ViewState>) =>
    setV((old) => {
      const next = { ...old, ...patch };
      localStorage.setItem(`console:view:${key}`, JSON.stringify({ ...next, q: "" }));
      return next;
    });
  return [v, update] as const;
}

export const FIELDS: Record<string, { name: string; options: (s: Snapshot) => Option[] }> = {
  status: { name: "Status", options: () => STATUSES.map((x) => ({ id: x.id, label: x.name, icon: <StatusIcon status={x.id} /> })) },
  assignee: { name: "Assignee", options: (s) => [{ id: "none", label: "Unassigned" }, ...s.people.map((p) => ({ id: p.id, label: p.id === s.viewer.id ? `${p.name} (you)` : p.name, icon: <PersonAvatar person={p} size="xs" /> }))] },
  priority: { name: "Priority", options: () => PRIOS.map((p) => ({ id: p.id, label: p.name, icon: <PriorityIcon priority={p.id} /> })) },
  due: {
    name: "Due date",
    options: () => [
      { id: "overdue", label: "Overdue" },
      { id: "today", label: "Today" },
      { id: "week", label: "Next 7 days" },
      { id: "later", label: "Later" },
      { id: "nodate", label: "No due date" },
    ],
  },
  project: { name: "Project", options: (s) => openProjects(s).map((p) => ({ id: p.id, label: p.name, icon: <ProjectIcon p={p} size="sm" /> })) },
  labels: { name: "Labels", options: () => LABELS.map((l) => ({ id: l.id, label: l.name, icon: <span className="size-2 rounded-full" style={{ background: l.c }} /> })) },
  created: { name: "Created", options: () => [{ id: "1", label: "Last 24 hours" }, { id: "7", label: "Last 7 days" }, { id: "30", label: "Last 30 days" }] },
  updated: { name: "Updated", options: () => [{ id: "1", label: "Last 24 hours" }, { id: "7", label: "Last 7 days" }, { id: "30", label: "Last 30 days" }] },
};

function dueBucket(t: Task) {
  if (!t.due) return "nodate";
  if (isOver(t)) return "overdue";
  const n = dayDiff(t.due);
  return n === 0 ? "today" : n <= 7 ? "week" : "later";
}

export function matches(t: Task, f: Filter) {
  if (!f.v.length) return true;
  const hit =
    f.f === "labels" ? f.v.some((v) => t.labels.includes(v))
    : f.f === "assignee" ? f.v.includes(t.assignee_id ?? "none")
    : f.f === "project" ? f.v.includes(t.project_id)
    : f.f === "due" ? f.v.includes(dueBucket(t))
    : f.f === "created" || f.f === "updated" ? f.v.some((v) => Date.now() - (f.f === "created" ? t.created_at : t.updated_at) <= Number(v) * 864e5)
    : f.v.includes(String(t[f.f as keyof Task]));
  return f.op === "not" ? !hit : hit;
}

const PRIO_W = Object.fromEntries(PRIOS.map((p) => [p.id, p.w]));

export function sortTasks(s: Snapshot, ts: Task[], sort: ViewState["sort"]) {
  const key: (t: Task) => string | number =
    {
      manual: (t: Task) => t.ord,
      title: (t: Task) => t.title.toLowerCase(),
      due: (t: Task) => t.due ?? "9999",
      start: (t: Task) => t.start ?? "9999",
      priority: (t: Task) => -PRIO_W[t.priority],
      status: (t: Task) => STATUSES.findIndex((x) => x.id === t.status),
      assignee: (t: Task) => personOf(s, t.assignee_id)?.name ?? "~",
      created: (t: Task) => -t.created_at,
      updated: (t: Task) => -t.updated_at,
      project: (t: Task) => projectOf(s, t.project_id)?.name ?? "",
    }[sort.f] ?? ((t: Task) => t.ord);
  return [...ts].sort((a, b) => {
    const x = key(a), y = key(b);
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  });
}

export function applyView(s: Snapshot, ts: Task[], v: ViewState) {
  const q = v.q.trim().toLowerCase();
  return sortTasks(
    s,
    ts.filter((t) => v.filters.every((f) => matches(t, f)) && (v.showDone || t.status !== "done") && (!q || t.title.toLowerCase().includes(q) || taskKey(s, t).toLowerCase().includes(q))),
    v.sort,
  );
}

export interface Group {
  key: string;
  name: string;
  icon?: React.ReactNode;
  /** What a task dropped or created in this group gets. */
  set: Partial<Task>;
  tasks: Task[];
}

export function groupTasks(s: Snapshot, ts: Task[], by: string): Group[] {
  if (by === "none") return [{ key: "all", name: "All tasks", set: {}, tasks: ts }];
  let groups: Omit<Group, "tasks">[];
  if (by === "status") groups = STATUSES.map((x) => ({ key: x.id, name: x.name, icon: <StatusIcon status={x.id} />, set: { status: x.id } }));
  else if (by === "priority") groups = PRIOS.map((p) => ({ key: p.id, name: p.name, icon: <PriorityIcon priority={p.id} />, set: { priority: p.id } }));
  else if (by === "assignee") groups = [...s.people.map((p) => ({ key: p.id, name: p.name, icon: <PersonAvatar person={p} size="xs" />, set: { assignee_id: p.id } })), { key: "none", name: "Unassigned", set: { assignee_id: null } }];
  else if (by === "project") groups = openProjects(s).map((p) => ({ key: p.id, name: p.name, icon: <ProjectIcon p={p} size="sm" />, set: { project_id: p.id } }));
  else groups = FIELDS.due.options(s).map((o) => ({ key: o.id, name: o.label, set: {} }));
  const of = (t: Task, g: string) =>
    by === "assignee" ? (t.assignee_id ?? "none") === g : by === "project" ? t.project_id === g : by === "due" ? dueBucket(t) === g : t[by as "status" | "priority"] === g;
  const out = groups.map((g) => ({ ...g, tasks: ts.filter((t) => of(t, g.key)) }));
  return by === "status" || by === "priority" ? out : out.filter((g) => g.tasks.length);
}

const SORTS = [
  ["manual", "Manual"], ["due", "Due date"], ["priority", "Priority"], ["status", "Status"], ["title", "Title"],
  ["assignee", "Assignee"], ["start", "Start date"], ["created", "Created"], ["updated", "Updated"], ["project", "Project"],
] as const;
const GROUPS = [["status", "Status"], ["priority", "Priority"], ["assignee", "Assignee"], ["project", "Project"], ["due", "Due date"], ["none", "None"]] as const;

/** Search, Filter, Sort, Group (+ Save view) over a task view. */
export function Toolbar({ s, v, set, group = true, projectId, viewType, right, hideFields = [] }: { s: Snapshot; v: ViewState; set: (p: Partial<ViewState>) => void; group?: boolean; projectId?: string | null; viewType?: "board" | "list" | "table" | "calendar" | "timeline"; right?: React.ReactNode; hideFields?: string[] }) {
  const fields = Object.entries(FIELDS).filter(([k]) => !hideFields.includes(k));
  return (
    <div className="flex flex-col gap-2 px-4 sm:px-8">
      <div role="toolbar" aria-label="View options" className="flex flex-wrap items-center gap-1.5">
        <SearchField value={v.q} onChange={(q) => set({ q })} label="Search tasks" className="sm:w-48" />
        <Pick label="Filter" options={fields.map(([k, f]) => ({ id: k, label: f.name }))} value={null} onChange={(f) => set({ filters: [...v.filters, { f, op: "is", v: [] }] })} className="h-8 px-2">
          <RiFilter3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">Filter</span>
          {v.filters.length > 0 && <span className="rounded-sm bg-accent-500 px-1 text-caption-1-semibold text-text-white">{v.filters.length}</span>}
        </Pick>
        <Pick label="Sort" options={SORTS.map(([id, label]) => ({ id, label }))} value={v.sort.f} onChange={(f) => set({ sort: { f, dir: f === v.sort.f ? (v.sort.dir === 1 ? -1 : 1) : 1 } })} className="h-8 px-2">
          <RiArrowUpDownLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">
            <span className="hidden sm:inline">Sort: </span>
            {SORTS.find(([id]) => id === v.sort.f)?.[1]}
            {v.sort.dir === -1 ? " ↓" : ""}
          </span>
        </Pick>
        {group && (
          <Pick label="Group" options={GROUPS.filter(([id]) => id !== "project" || !projectId).map(([id, label]) => ({ id, label }))} value={v.group} onChange={(g) => set({ group: g })} className="h-8 px-2">
            <RiLayoutRowLine className="size-4 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium text-text-primary">
              <span className="hidden sm:inline">Group: </span>
              {GROUPS.find(([id]) => id === v.group)?.[1]}
            </span>
          </Pick>
        )}
        <button onClick={() => set({ showDone: !v.showDone })} aria-pressed={!v.showDone} className="h-8 rounded-lg px-2 text-body-medium text-text-secondary hover:bg-background-secondary-hover">
          {v.showDone ? "Hide done" : "Show done"}
        </button>
        <span className="flex-1" />
        {right}
      </div>
      {v.filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {v.filters.map((f, i) => {
            const F = FIELDS[f.f];
            const opts = F.options(s);
            const names = f.v.map((id) => opts.find((o) => o.id === id)?.label ?? id);
            const edit = (patch: Partial<Filter>) => set({ filters: v.filters.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <span key={i} className="flex items-center rounded-lg border border-border-button-default bg-background-primary-default">
                <span className="ps-2 text-body-2-medium text-text-secondary">{F.name}</span>
                <button onClick={() => edit({ op: f.op === "not" ? "is" : "not" })} className="px-1.5 text-body-2-medium text-text-tertiary hover:text-text-primary">
                  {f.op === "not" ? "is not" : "is"}
                </button>
                <Pick label={F.name} multi options={opts} value={f.v} onChange={(id) => edit({ v: f.v.includes(id) ? f.v.filter((x) => x !== id) : [...f.v, id] })} className="py-0.5">
                  <span className="text-body-2-medium text-text-primary">{names.length ? (names.length > 2 ? `${names.length} selected` : names.join(", ")) : "any"}</span>
                </Pick>
                <button aria-label="Remove filter" onClick={() => set({ filters: v.filters.filter((_, j) => j !== i) })} className="pe-1.5 text-foreground-icon-tertiary hover:text-text-primary">
                  <RiCloseLine className="size-4" aria-hidden />
                </button>
              </span>
            );
          })}
          <button onClick={() => set({ filters: [] })} className="px-1.5 text-body-2-medium text-text-tertiary hover:text-text-primary">
            Clear
          </button>
          {viewType && (
            <Button size="small" variant="ghost" leadingIcon={RiBookmarkLine} onClick={() => saveViewModal(projectId ?? null, viewType, v.filters.filter((f) => f.v.length))}>
              Save view
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const AddButton = ({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) => (
  <button onClick={onClick} className={cx("flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-body-medium text-text-tertiary hover:bg-background-secondary-hover hover:text-text-primary", className)}>
    <RiAddLine className="size-4" aria-hidden />
    {label}
  </button>
);
