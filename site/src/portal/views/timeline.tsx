import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { navigate, withTask } from "../router";
import { canEdit, liveTasks, openProjects, projectOf, save, taskKey, useSnap } from "../store";
import type { Milestone, Project, Task } from "../types";
import { PageHeader, PersonAvatar, StatusIcon, addDays, fmtDay, isoDay, tint } from "../ui";
import { Toolbar, applyView, groupTasks, useView } from "./engine";

type Zoom = "week" | "month" | "quarter";
const COL: Record<Zoom, number> = { week: 36, month: 14, quarter: 5 };
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** gr8r's Gantt: bars from start to due, drag to move, drag an edge to resize. */
export function Timeline({ tasks, group, milestones = [], projects = [] }: { tasks: Task[]; group: string; milestones?: Milestone[]; projects?: Project[] }) {
  const s = useSnap();
  const [zoom, setZoom] = useState<Zoom>(() => (localStorage.getItem("console:tl-zoom") as Zoom) ?? "week");
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ id: string; start: string; due: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const today = isoDay(new Date());
  const w = COL[zoom];

  const dated = tasks.filter((t) => t.start || t.due);
  const unscheduled = tasks.filter((t) => !t.start && !t.due);
  const allDates = [today, ...dated.flatMap((t) => [t.start, t.due].filter(Boolean) as string[]), ...milestones.map((m) => m.date).filter(Boolean) as string[]];
  const from = addDays(allDates.reduce((a, b) => (a < b ? a : b)), -7);
  const to = addDays(allDates.reduce((a, b) => (a > b ? a : b)), 21);
  const span = Math.max(days(from, to), zoom === "week" ? 42 : 120);
  const x = (d: string) => days(from, d) * w;

  useEffect(() => {
    scroller.current?.scrollTo({ left: Math.max(0, x(today) - 200) });
  }, [zoom, from]);

  const drag = (t: Task, mode: "move" | "start" | "end") => (e: PointerEvent) => {
    if (!canEdit(projectOf(s, t.project_id))) return;
    e.preventDefault();
    e.stopPropagation();
    const start0 = t.start ?? t.due!, due0 = t.due ?? t.start!;
    const x0 = e.clientX;
    let moved = false;
    const calc = (cx: number) => {
      const n = Math.round((cx - x0) / w);
      if (n) moved = true;
      if (mode === "move") return { start: addDays(start0, n), due: addDays(due0, n) };
      if (mode === "start") return { start: addDays(start0, Math.min(n, days(start0, due0))), due: due0 };
      return { start: start0, due: addDays(due0, Math.max(n, -days(start0, due0))) };
    };
    const onMove = (ev: globalThis.PointerEvent) => setPreview({ id: t.id, ...calc(ev.clientX) });
    const onUp = (ev: globalThis.PointerEvent) => {
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      setPreview(null);
      const next = calc(ev.clientX);
      if (!moved) return navigate(withTask(t.id));
      void save("task", t.id, next);
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
  };

  const groups = groupTasks(s, dated, group);
  const header: { label: string; left: number; width: number }[] = [];
  for (let d = from; days(d, addDays(from, span)) > 0; ) {
    const dt = new Date(`${d}T00:00:00`);
    const next = isoDay(new Date(dt.getFullYear(), dt.getMonth() + 1, 1));
    const end = days(next, addDays(from, span)) > 0 ? next : addDays(from, span);
    header.push({ label: dt.toLocaleDateString("en-US", { month: "long", year: dt.getMonth() === 0 || header.length === 0 ? "numeric" : undefined }), left: x(d), width: days(d, end) * w });
    d = next;
  }

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" variant="secondary" onClick={() => scroller.current?.scrollTo({ left: Math.max(0, x(today) - 200), behavior: "smooth" })}>
          Today
        </Button>
        <span className="flex-1" />
        <SegmentedControl aria-label="Zoom" selectedKeys={new Set([zoom])} onSelectionChange={(k) => { const z = [...k][0] as Zoom; if (z) { setZoom(z); localStorage.setItem("console:tl-zoom", z); } }}>
          <SegmentedControlItem id="week">Weeks</SegmentedControlItem>
          <SegmentedControlItem id="month">Months</SegmentedControlItem>
          <SegmentedControlItem id="quarter">Quarters</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="flex overflow-hidden rounded-3xl border border-border-button-default">
        <div className="w-60 shrink-0 border-e border-separator-border">
          <div className="h-14 border-b border-separator-border bg-background-secondary-default" />
          {projects.length > 0 && <div className="flex h-9 items-center border-b border-separator-border px-3 text-caption-1-semibold text-text-tertiary">Milestones</div>}
          {groups.map((g) => (
            <div key={g.key}>
              {group !== "none" && (
                <button onClick={() => setFolded((f) => ({ ...f, [g.key]: !f[g.key] }))} className="flex h-9 w-full items-center gap-2 border-b border-separator-border bg-background-secondary-default/60 px-3 text-start">
                  {folded[g.key] ? <RiArrowRightSLine className="size-4 text-foreground-icon-tertiary" aria-hidden /> : <RiArrowDownSLine className="size-4 text-foreground-icon-tertiary" aria-hidden />}
                  {g.icon}
                  <span className="truncate text-body-2-medium text-text-primary">{g.name}</span>
                  <span className="text-caption-1-medium text-text-tertiary">{g.tasks.length}</span>
                </button>
              )}
              {!folded[g.key] &&
                g.tasks.map((t) => (
                  <button key={t.id} onClick={() => navigate(withTask(t.id))} className="flex h-10 w-full items-center gap-2 border-b border-separator-border px-3 text-start hover:bg-background-secondary-default">
                    <StatusIcon status={t.status} />
                    <span className="truncate text-body-2-medium text-text-primary">{t.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: span * w }}>
            <div className="sticky top-0 h-14 border-b border-separator-border bg-background-secondary-default">
              {header.map((h) => (
                <span key={h.left} style={{ left: h.left, width: h.width }} className="absolute top-0 h-7 truncate border-s border-separator-border px-2 pt-1.5 text-caption-1-semibold text-text-secondary">
                  {h.label}
                </span>
              ))}
              {zoom !== "quarter" &&
                Array.from({ length: span }, (_, i) => {
                  const d = addDays(from, i);
                  const dt = new Date(`${d}T00:00:00`);
                  if (zoom === "month" && dt.getDay() !== 1) return null;
                  return (
                    <span key={d} style={{ left: i * w, width: zoom === "week" ? w : w * 7 }} className={cx("absolute top-7 h-7 pt-1 text-center text-caption-2-medium", d === today ? "text-accent-500" : dt.getDay() % 6 === 0 ? "text-text-tertiary" : "text-text-secondary")}>
                      {dt.getDate()}
                    </span>
                  );
                })}
            </div>
            {/* weekends and today */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-14 bottom-0">
              {zoom === "week" &&
                Array.from({ length: span }, (_, i) => (new Date(`${addDays(from, i)}T00:00:00`).getDay() % 6 === 0 ? <span key={i} style={{ left: i * w, width: w }} className="absolute inset-y-0 bg-background-secondary-default/60" /> : null))}
              <span style={{ left: x(today) + w / 2 }} className="absolute inset-y-0 w-px bg-accent-500" />
            </div>
            {projects.length > 0 && (
              <div className="relative h-9 border-b border-separator-border">
                {projects.flatMap((p) =>
                  p.milestones.filter((m) => m.date).map((m) => (
                    <span key={m.id} style={{ left: x(m.date!) + w / 2 - 6, ...tint(p.color) }} title={`${m.name} · ${fmtDay(m.date!)}`} className="absolute top-3 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="size-3 rotate-45 rounded-[2px] bg-[var(--c)]" />
                      <span className="text-caption-1-medium text-text-secondary">{m.name}</span>
                    </span>
                  )),
                )}
              </div>
            )}
            {groups.map((g) => (
              <div key={g.key}>
                {group !== "none" && <div className="h-9 border-b border-separator-border bg-background-secondary-default/30" />}
                {!folded[g.key] &&
                  g.tasks.map((t) => {
                    const pv = preview?.id === t.id ? preview : null;
                    const start = pv?.start ?? t.start ?? t.due!;
                    const due = pv?.due ?? t.due ?? t.start!;
                    const p = projectOf(s, t.project_id);
                    const edit = canEdit(p);
                    return (
                      <div key={t.id} className="relative h-10 border-b border-separator-border">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${t.title}, ${fmtDay(start)} to ${fmtDay(due)}`}
                          onPointerDown={drag(t, "move")}
                          onKeyDown={(e) => e.key === "Enter" && navigate(withTask(t.id))}
                          style={{ left: x(start), width: (days(start, due) + 1) * w, ...(p ? tint(p.color) : {}) }}
                          className={cx(
                            "group absolute top-1.5 flex h-7 touch-none items-center gap-1.5 overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--c)_22%,transparent)] px-2 text-caption-1-medium text-text-primary outline-none select-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                            edit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            t.status === "done" && "opacity-60",
                          )}
                        >
                          {edit && <span onPointerDown={drag(t, "start")} className="absolute inset-y-0 start-0 w-1.5 cursor-ew-resize bg-[var(--c)] opacity-0 group-hover:opacity-70" />}
                          <span className="truncate">{zoom === "quarter" ? "" : `${taskKey(s, t)} ${t.title}`}</span>
                          <PersonAvatar person={s.people.find((x) => x.id === t.assignee_id)} size="xs" className="ms-auto shrink-0" />
                          {edit && <span onPointerDown={drag(t, "end")} className="absolute inset-y-0 end-0 w-1.5 cursor-ew-resize bg-[var(--c)] opacity-0 group-hover:opacity-70" />}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {unscheduled.length > 0 && (
        <details className="rounded-2xl border border-border-button-default px-4 py-3">
          <summary className="cursor-pointer text-body-medium text-text-primary">Unscheduled ({unscheduled.length})</summary>
          <ul className="mt-2 flex flex-col">
            {unscheduled.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1">
                <StatusIcon status={t.status} />
                <button onClick={() => navigate(withTask(t.id))} className="min-w-0 flex-1 truncate text-start text-body-medium text-text-primary hover:underline">
                  {t.title}
                </button>
                {canEdit(projectOf(s, t.project_id)) && (
                  <Button size="xs" variant="secondary" onClick={() => save("task", t.id, { start: today, due: addDays(today, 3) })}>
                    Schedule this week
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Workspace-wide timeline page. */
export function TimelinePage() {
  const s = useSnap();
  const [v, set] = useView("timeline", { group: "project" });
  const tasks = applyView(s, liveTasks(s), v);
  return (
    <>
      <PageHeader title="Timeline" subtitle="Every scheduled task, with project milestones." />
      <div className="flex flex-col gap-3">
        <Toolbar s={s} v={v} set={set} viewType="timeline" />
        <Timeline tasks={tasks} group={v.group} projects={openProjects(s)} milestones={openProjects(s).flatMap((p) => p.milestones)} />
      </div>
    </>
  );
}
