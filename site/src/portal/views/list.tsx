import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import { RiArchiveLine, RiArrowDownSLine, RiArrowRightSLine, RiAttachment2, RiChat3Line, RiCheckboxCircleLine, RiCloseLine, RiDeleteBinLine, RiEyeOffLine, RiListCheck3 } from "@remixicon/react";
import { useState, type DragEvent } from "react";
import { taskMenu } from "../overlays/drawer";
import { openContextMenu } from "../overlays/layer";
import { confirm } from "../overlays/modals";
import { AssigneePick, Pick, PriorityPick, StatusPick, peopleOptions, priorityOptions, statusOptions } from "../overlays/pickers";
import { navigate, withTask } from "../router";
import { archive, canEdit, createTask, projectOf, remove, save, setTaskStatus, taskKey, useSnap } from "../store";
import type { Snapshot, Task } from "../types";
import { DueDate, Empty, LabelChip, ProjectIcon } from "../ui";
import { groupTasks, type Group } from "./engine";

/** Midpoint ordering: dropping between two rows never renumbers the list. */
export function ordBetween(before: Task | undefined, after: Task | undefined) {
  if (before && after) return (before.ord + after.ord) / 2;
  if (before) return before.ord + 1024;
  if (after) return after.ord - 1024;
  return Date.now();
}

/** gr8r's task list: grouped, collapsible, drag to reorder or regroup, bulk edit. */
export function TaskList({ tasks, group, showProject = false, projectId, empty, collapseKey = "list" }: { tasks: Task[]; group: string; showProject?: boolean; projectId?: string; empty?: React.ReactNode; collapseKey?: string }) {
  const s = useSnap();
  const groups = groupTasks(s, tasks, group);
  const [closed, setClosed] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem(`console:closed:${collapseKey}`) ?? "{}"));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const toggle = (k: string) => setClosed((c) => (localStorage.setItem(`console:closed:${collapseKey}`, JSON.stringify({ ...c, [k]: !c[k] })), { ...c, [k]: !c[k] }));
  const select = (id: string, on: boolean) => setSel((x) => (on ? new Set([...x, id]) : new Set([...x].filter((y) => y !== id))));

  const drop = (g: Group, before?: Task) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const t = s.tasks.find((x) => x.id === drag);
    setDrag(null);
    if (!t || t.id === before?.id) return;
    const list = g.tasks.filter((x) => x.id !== t.id);
    const i = before ? list.findIndex((x) => x.id === before.id) : list.length;
    void save("task", t.id, { ...g.set, ord: ordBetween(list[i - 1], list[i]) });
  };

  if (!tasks.length && empty) return <>{empty}</>;
  return (
    <div className="@container flex flex-col gap-4 px-2 sm:px-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.name} onDragOver={(e) => drag && (e.preventDefault(), setOver(g.key))} onDrop={drop(g)} className={cx("rounded-2xl", over === g.key && "bg-background-secondary-default")}>
          {group !== "none" && (
            <button onClick={() => toggle(g.key)} aria-expanded={!closed[g.key]} className="flex w-full items-center gap-2 border-b border-separator-border px-2 py-2 text-start">
              {closed[g.key] ? <RiArrowRightSLine className="size-4 text-foreground-icon-tertiary" aria-hidden /> : <RiArrowDownSLine className="size-4 text-foreground-icon-tertiary" aria-hidden />}
              {g.icon}
              <span className="text-body-medium text-text-primary">{g.name}</span>
              <span className="text-body-2-medium text-text-tertiary">{g.tasks.length}</span>
            </button>
          )}
          {!closed[g.key] && (
            <ul>
              {g.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  s={s}
                  showProject={showProject}
                  selected={sel.has(t.id)}
                  onSelect={(on) => select(t.id, on)}
                  dragging={drag === t.id}
                  onDragStart={() => setDrag(t.id)}
                  onDragEnd={() => (setDrag(null), setOver(null))}
                  onDrop={drop(g, t)}
                />
              ))}
              {(projectId || g.set.project_id) && canEdit(projectOf(s, projectId ?? g.set.project_id)) && <InlineAdd projectId={(projectId ?? g.set.project_id)!} set={g.set} />}
            </ul>
          )}
        </section>
      ))}
      {sel.size > 0 && <BulkBar s={s} ids={[...sel]} clear={() => setSel(new Set())} />}
    </div>
  );
}

export function TaskRow({ t, s, showProject, selected, onSelect, dragging, onDragStart, onDragEnd, onDrop }: { t: Task; s: Snapshot; showProject?: boolean; selected?: boolean; onSelect?: (on: boolean) => void; dragging?: boolean; onDragStart?: () => void; onDragEnd?: () => void; onDrop?: (e: DragEvent) => void }) {
  const p = projectOf(s, t.project_id);
  const edit = canEdit(p);
  const comments = s.comments.filter((c) => c.task_id === t.id).length;
  const files = s.files.filter((f) => f.task_id === t.id).length;
  const subDone = t.subtasks.filter((x) => x.done).length;
  return (
    <li
      draggable={edit}
      onDragStart={(e) => (e.dataTransfer.setData("text/plain", t.id), (e.dataTransfer.effectAllowed = "move"), onDragStart?.())}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={(e) => openContextMenu(e, taskMenu(s, t))}
      className={cx("group flex min-h-11 items-center gap-1.5 border-b border-separator-border px-2 transition-opacity hover:bg-background-secondary-default", dragging && "opacity-40", selected && "bg-accent-500/5")}
    >
      {onSelect && (
        <span className={cx("flex w-5 justify-center", !selected && "invisible group-hover:visible")}>
          <Checkbox size="sm" isSelected={selected} onChange={onSelect} aria-label={`Select ${t.title}`} />
        </span>
      )}
      <StatusPick task={t} disabled={!edit} />
      <span className="hidden w-16 shrink-0 font-mono text-caption-1-medium text-text-tertiary @md:block">{taskKey(s, t)}</span>
      <button onClick={() => navigate(withTask(t.id))} className={cx("min-w-0 flex-1 truncate py-2 text-start text-body-medium outline-none hover:underline focus-visible:underline", t.status === "done" ? "text-text-tertiary line-through" : "text-text-primary")}>
        {t.title}
      </button>
      {t.internal && <RiEyeOffLine className="size-3.5 shrink-0 text-status-purple-text" aria-label="Internal" />}
      <span className="hidden items-center gap-2 text-caption-1-medium text-text-tertiary @3xl:flex">
        {t.subtasks.length > 0 && (
          <span className="flex items-center gap-0.5" title="Subtasks">
            <RiListCheck3 className="size-3.5" aria-hidden />
            {subDone}/{t.subtasks.length}
          </span>
        )}
        {comments > 0 && (
          <span className="flex items-center gap-0.5" title="Comments">
            <RiChat3Line className="size-3.5" aria-hidden />
            {comments}
          </span>
        )}
        {files > 0 && (
          <span className="flex items-center gap-0.5" title="Attachments">
            <RiAttachment2 className="size-3.5" aria-hidden />
            {files}
          </span>
        )}
      </span>
      <span className="hidden gap-1 @4xl:flex">{t.labels.slice(0, 2).map((l) => <LabelChip key={l} id={l} />)}</span>
      {showProject && p && (
        <span className="hidden max-w-36 items-center gap-1.5 truncate text-body-2-medium text-text-secondary @2xl:flex">
          <ProjectIcon p={p} size="sm" />
          <span className="truncate">{p.name}</span>
        </span>
      )}
      <DueDate task={t} className="w-20 text-end" />
      <PriorityPick task={t} disabled={!edit} />
      <AssigneePick task={t} disabled={!edit} />
    </li>
  );
}

function InlineAdd({ projectId, set }: { projectId: string; set: Partial<Task> }) {
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(false);
  if (!on)
    return (
      <li>
        <button onClick={() => setOn(true)} className="flex w-full items-center gap-2 px-2 py-2 text-body-medium text-text-tertiary hover:text-text-primary">
          <span className="w-5" />+ Add task
        </button>
      </li>
    );
  return (
    <li className="flex items-center gap-2 border-b border-separator-border px-2 py-1.5">
      <span className="w-5" />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOn(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return (setTitle(""), setOn(false));
          if (e.key !== "Enter" || !title.trim()) return;
          void createTask({ project_id: projectId, ...set, title: title.trim() });
          setTitle("");
        }}
        placeholder="Task title, then Enter"
        aria-label="New task title"
        className="min-w-0 flex-1 bg-transparent py-1 text-body-medium text-text-primary outline-none placeholder:text-text-placeholder"
      />
    </li>
  );
}

function BulkBar({ s, ids, clear }: { s: Snapshot; ids: string[]; clear: () => void }) {
  const tasks = s.tasks.filter((t) => ids.includes(t.id));
  const all = (patch: Partial<Task>) => tasks.forEach((t) => save("task", t.id, patch));
  return (
    <div role="toolbar" aria-label="Selected tasks" className="rise fixed inset-x-0 bottom-20 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-2xl border border-border-button-default bg-background-primary-default p-1.5 shadow-dropdown lg:bottom-6">
      <span className="px-2 text-body-medium text-text-primary">{ids.length} selected</span>
      <Pick label="Status" options={statusOptions} value={null} onChange={(st) => tasks.forEach((t) => setTaskStatus(t, st as Task["status"]))} className="h-8">
        <RiCheckboxCircleLine className="size-4" aria-hidden /> <span className="text-body-medium">Status</span>
      </Pick>
      <Pick label="Priority" options={priorityOptions} value={null} onChange={(priority) => all({ priority: priority as Task["priority"] })} className="h-8">
        <span className="text-body-medium">Priority</span>
      </Pick>
      <Pick label="Assignee" options={peopleOptions(s.people)} value={null} onChange={(id) => all({ assignee_id: id || null })} className="h-8">
        <span className="text-body-medium">Assign</span>
      </Pick>
      <Button size="small" variant="ghost" leadingIcon={RiArchiveLine} onClick={() => (tasks.forEach((t) => archive("task", t.id, t.title)), clear())}>
        Archive
      </Button>
      <Button
        size="small"
        variant="ghost"
        leadingIcon={RiDeleteBinLine}
        onClick={() =>
          confirm({ title: `Delete ${ids.length} tasks?`, body: "They're removed for everyone, with their comments and files.", action: "Delete", danger: true }).then((ok) => ok && (tasks.forEach((t) => remove("task", t.id)), clear()))
        }
      >
        Delete
      </Button>
      <button aria-label="Clear selection" onClick={clear} className="rounded-lg p-1.5 text-foreground-icon-tertiary hover:bg-background-secondary-hover">
        <RiCloseLine className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export const NoTasks = ({ title = "No tasks here", body }: { title?: string; body?: string }) => <Empty icon={RiCheckboxCircleLine} title={title} body={body} />;
