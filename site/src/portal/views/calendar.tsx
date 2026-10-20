import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { RiAddLine, RiArrowLeftSLine, RiArrowRightSLine, RiCalendarEventLine } from "@remixicon/react";
import { useState } from "react";
import { eventModal, newTask } from "../overlays/modals";
import { navigate, withTask } from "../router";
import { canEdit, liveTasks, personOf, projectOf, save, useSnap } from "../store";
import type { CalEvent, Task } from "../types";
import { PageHeader, PersonAvatar, PriorityIcon, StatusIcon, addDays, isoDay, tint } from "../ui";
import { Toolbar, applyView, useView } from "./engine";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monday = (d: string) => {
  const day = new Date(`${d}T00:00:00`).getDay();
  return addDays(d, -((day + 6) % 7));
};

/** Month or week grid of tasks (by due date) and events; drag a task to reschedule it. */
export function Calendar({ tasks, events, projectId }: { tasks: Task[]; events: CalEvent[]; projectId?: string }) {
  const s = useSnap();
  const [mode, setMode] = useState<"month" | "week">(() => (localStorage.getItem("console:cal-mode") as "month" | "week") ?? "month");
  const [cursor, setCursor] = useState(isoDay(new Date()));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = isoDay(new Date());
  const first = mode === "month" ? monday(`${cursor.slice(0, 8)}01`) : monday(cursor);
  const days = Array.from({ length: mode === "month" ? 42 : 7 }, (_, i) => addDays(first, i));
  const month = new Date(`${cursor}T00:00:00`).getMonth();
  const step = (n: number) => {
    const d = new Date(`${cursor}T00:00:00`);
    if (mode === "month") d.setMonth(d.getMonth() + n, 1);
    else d.setDate(d.getDate() + n * 7);
    setCursor(isoDay(d));
  };
  const title = new Date(`${(mode === "month" ? cursor : first)}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const onDay = (d: string) => ({ tasks: tasks.filter((t) => t.due === d), events: events.filter((e) => e.date === d) });
  const dropOn = (d: string) => {
    const t = tasks.find((x) => x.id === drag);
    setDrag(null);
    setOver(null);
    if (t && t.due !== d && canEdit(projectOf(s, t.project_id))) {
      // Keep the task's length when it has a start date.
      const len = t.start && t.due ? (Date.parse(t.due) - Date.parse(t.start)) / 864e5 : null;
      void save("task", t.id, { due: d, ...(len !== null ? { start: addDays(d, -len) } : {}) });
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-44 text-title-3-medium text-text-primary">{title}</h2>
        <IconButton icon={RiArrowLeftSLine} size="small" aria-label="Previous" onClick={() => step(-1)} />
        <Button size="small" variant="secondary" onClick={() => setCursor(today)}>
          Today
        </Button>
        <IconButton icon={RiArrowRightSLine} size="small" aria-label="Next" onClick={() => step(1)} />
        <span className="flex-1" />
        <Button size="small" variant="ghost" leadingIcon={RiCalendarEventLine} onClick={() => eventModal({ date: cursor, project_id: projectId })}>
          Event
        </Button>
        <SegmentedControl aria-label="Calendar mode" selectedKeys={new Set([mode])} onSelectionChange={(k) => { const m = [...k][0] as "month" | "week"; if (m) { setMode(m); localStorage.setItem("console:cal-mode", m); } }}>
          <SegmentedControlItem id="month">Month</SegmentedControlItem>
          <SegmentedControlItem id="week">Week</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border-button-default">
        <div className="grid grid-cols-7 border-b border-separator-border bg-background-secondary-default">
          {WEEKDAYS.map((d, i) => (
            <span key={d} className="px-2 py-2 text-caption-1-semibold text-text-tertiary">
              {d}
              {mode === "week" && <span className="ms-1 text-text-secondary">{new Date(`${days[i]}T00:00:00`).getDate()}</span>}
            </span>
          ))}
        </div>
        <div className={cx("grid grid-cols-7", mode === "month" ? "auto-rows-[minmax(112px,1fr)]" : "auto-rows-[minmax(420px,1fr)]")}>
          {days.map((d) => {
            const { tasks: ts, events: es } = onDay(d);
            const out = mode === "month" && new Date(`${d}T00:00:00`).getMonth() !== month;
            const limit = mode === "month" ? 3 : 99;
            const items = [...es.map((e) => ({ kind: "event" as const, e })), ...ts.map((t) => ({ kind: "task" as const, t }))];
            return (
              <div
                key={d}
                onDragOver={(e) => drag && (e.preventDefault(), setOver(d))}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => (e.preventDefault(), dropOn(d))}
                onDoubleClick={() => newTask({ due: d, ...(projectId ? { project_id: projectId } : {}) })}
                className={cx("group relative flex min-w-0 flex-col gap-1 border-e border-b border-separator-border p-1.5 [&:nth-child(7n)]:border-e-0", out && "bg-background-secondary-default/50", over === d && "bg-accent-500/10")}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={cx("flex size-6 items-center justify-center rounded-full text-caption-1-semibold", d === today ? "bg-accent-500 text-text-white" : out ? "text-text-tertiary" : "text-text-secondary")}>
                    {new Date(`${d}T00:00:00`).getDate()}
                  </span>
                  <button aria-label={`Add task on ${d}`} onClick={() => newTask({ due: d, ...(projectId ? { project_id: projectId } : {}) })} className="invisible rounded p-0.5 text-foreground-icon-tertiary group-hover:visible hover:text-text-primary">
                    <RiAddLine className="size-4" aria-hidden />
                  </button>
                </div>
                {items.slice(0, limit).map((it) =>
                  it.kind === "event" ? (
                    <button key={it.e.id} onClick={() => eventModal({}, it.e)} className="truncate rounded-md bg-status-blue-background px-1.5 py-0.5 text-start text-caption-1-medium text-status-blue-text">
                      {it.e.time && <span className="me-1 tabular-nums">{it.e.time}</span>}
                      {it.e.title}
                    </button>
                  ) : (
                    <CalTask key={it.t.id} t={it.t} week={mode === "week"} onDrag={() => setDrag(it.t.id)} onDragEnd={() => setDrag(null)} />
                  ),
                )}
                {items.length > limit && (
                  <button onClick={() => (setMode("week"), setCursor(d))} className="px-1.5 text-start text-caption-1-medium text-text-tertiary hover:text-text-primary">
                    +{items.length - limit} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-caption-1-medium text-text-tertiary">Drag a task to another day to reschedule it. Double-click a day to add a task.</p>
    </div>
  );
}

function CalTask({ t, week, onDrag, onDragEnd }: { t: Task; week: boolean; onDrag: () => void; onDragEnd: () => void }) {
  const s = useSnap();
  const p = projectOf(s, t.project_id);
  return (
    <button
      draggable={canEdit(p)}
      onDragStart={(e) => (e.dataTransfer.setData("text/plain", t.id), onDrag())}
      onDragEnd={onDragEnd}
      onClick={() => navigate(withTask(t.id))}
      title={t.title}
      style={p ? tint(p.color) : undefined}
      className={cx(
        "flex min-w-0 items-center gap-1 rounded-md border-s-2 border-[var(--c)] bg-background-primary-default px-1.5 py-0.5 text-start text-caption-1-medium shadow-xs dark:bg-background-tertiary-default",
        week && "flex-col items-start gap-1 py-1.5",
        t.status === "done" ? "text-text-tertiary line-through" : "text-text-primary",
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1">
        {t.status === "done" ? <StatusIcon status="done" className="size-3" /> : <PriorityIcon priority={t.priority} className="size-3" />}
        <span className="truncate">{t.title}</span>
      </span>
      {week && (
        <span className="flex w-full items-center gap-1 text-text-tertiary">
          <span className="flex-1 truncate">{p?.name}</span>
          <PersonAvatar person={personOf(s, t.assignee_id)} size="xs" />
        </span>
      )}
    </button>
  );
}

/** Workspace-wide calendar page. */
export function CalendarPage() {
  const s = useSnap();
  const [v, set] = useView("calendar", { group: "none" });
  const tasks = applyView(s, liveTasks(s), v);
  return (
    <>
      <PageHeader title="Calendar" subtitle="Every dated task and event in the workspace." />
      <div className="flex flex-col gap-3">
        <Toolbar s={s} v={v} set={set} group={false} viewType="calendar" />
        <Calendar tasks={tasks} events={s.events} />
      </div>
    </>
  );
}
