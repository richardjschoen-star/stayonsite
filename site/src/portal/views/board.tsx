import { cx } from "@/utils/cx";
import { RiAddLine, RiArrowLeftSLine, RiAttachment2, RiChat3Line, RiEyeOffLine } from "@remixicon/react";
import { useState, type DragEvent } from "react";
import { taskMenu } from "../overlays/drawer";
import { openContextMenu } from "../overlays/layer";
import { AssigneePick, PriorityPick } from "../overlays/pickers";
import { navigate, withTask } from "../router";
import { canEdit, createTask, projectOf, save, taskKey, taskProgress, useSnap } from "../store";
import type { Task } from "../types";
import { DueDate, LabelChip, ProjectIcon } from "../ui";
import { Progress } from "../overlays/drawer";
import { groupTasks, type Group } from "./engine";
import { ordBetween } from "./list";

/** Columns per status (or any grouping); drag cards across, add inline, fold columns away. */
export function Board({ tasks, group = "status", projectId, showProject = false }: { tasks: Task[]; group?: string; projectId?: string; showProject?: boolean }) {
  const s = useSnap();
  const cols = groupTasks(s, tasks, group === "none" ? "status" : group);
  const key = `console:cols:${projectId ?? "all"}`;
  const [folded, setFolded] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem(key) ?? "{}"));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; before?: string } | null>(null);
  const fold = (k: string) => setFolded((f) => (localStorage.setItem(key, JSON.stringify({ ...f, [k]: !f[k] })), { ...f, [k]: !f[k] }));

  const drop = (g: Group, before?: Task) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const t = s.tasks.find((x) => x.id === drag);
    setDrag(null);
    if (!t || t.id === before?.id) return;
    const list = g.tasks.filter((x) => x.id !== t.id);
    const i = before ? list.findIndex((x) => x.id === before.id) : list.length;
    if (g.set.status && g.set.status !== t.status && g.set.status === "done") save("task", t.id, { ...g.set, ord: ordBetween(list[i - 1], list[i]), completed_at: Date.now() });
    else void save("task", t.id, { ...g.set, ord: ordBetween(list[i - 1], list[i]) });
  };

  return (
    <div className="flex min-h-[60vh] gap-3 overflow-x-auto px-4 pb-4 sm:px-8">
      {cols.map((g) =>
        folded[g.key] ? (
          <button key={g.key} onClick={() => fold(g.key)} aria-label={`Expand ${g.name}`} className="flex w-11 shrink-0 flex-col items-center gap-3 rounded-3xl bg-background-secondary-default py-3 hover:bg-background-secondary-hover">
            {g.icon}
            <span className="text-body-medium text-text-secondary [writing-mode:vertical-rl]">{g.name}</span>
            <span className="text-caption-1-medium text-text-tertiary">{g.tasks.length}</span>
          </button>
        ) : (
          <section
            key={g.key}
            aria-label={g.name}
            onDragOver={(e) => drag && (e.preventDefault(), setOver({ col: g.key }))}
            onDrop={drop(g)}
            className={cx("flex w-[290px] shrink-0 flex-col rounded-3xl bg-background-secondary-default p-2 transition-colors", over?.col === g.key && "bg-background-secondary-hover")}
          >
            <header className="flex items-center gap-2 px-2 pt-1 pb-2">
              {g.icon}
              <h3 className="text-body-medium text-text-primary">{g.name}</h3>
              <span className="text-body-2-medium text-text-tertiary">{g.tasks.length}</span>
              <span className="flex-1" />
              <button aria-label={`Fold ${g.name}`} onClick={() => fold(g.key)} className="rounded p-0.5 text-foreground-icon-tertiary hover:text-text-primary">
                <RiArrowLeftSLine className="size-4" aria-hidden />
              </button>
            </header>
            <div className="flex min-h-12 flex-1 flex-col gap-2">
              {g.tasks.map((t) => (
                <Card key={t.id} t={t} showProject={showProject} dragging={drag === t.id} marker={over?.before === t.id} onDragStart={() => setDrag(t.id)} onDragEnd={() => (setDrag(null), setOver(null))} onDragOver={() => drag && setOver({ col: g.key, before: t.id })} onDrop={drop(g, t)} />
              ))}
              <AddCard projectId={projectId ?? g.set.project_id} set={g.set} />
            </div>
          </section>
        ),
      )}
      <span className="w-2 shrink-0" aria-hidden />
    </div>
  );
}

function Card({ t, showProject, dragging, marker, onDragStart, onDragEnd, onDragOver, onDrop }: { t: Task; showProject: boolean; dragging: boolean; marker: boolean; onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: (e: DragEvent) => void }) {
  const s = useSnap();
  const p = projectOf(s, t.project_id);
  const edit = canEdit(p);
  const comments = s.comments.filter((c) => c.task_id === t.id).length;
  const files = s.files.filter((f) => f.task_id === t.id).length;
  return (
    <article
      draggable={edit}
      onDragStart={(e) => (e.dataTransfer.setData("text/plain", t.id), (e.dataTransfer.effectAllowed = "move"), onDragStart())}
      onDragEnd={onDragEnd}
      onDragOver={(e) => (e.preventDefault(), onDragOver())}
      onDrop={onDrop}
      onContextMenu={(e) => openContextMenu(e, taskMenu(s, t))}
      className={cx(
        "group relative flex cursor-grab flex-col gap-2 rounded-2xl border border-border-button-default bg-background-primary-default p-3 shadow-xs transition-[opacity,box-shadow] hover:shadow-dropdown active:cursor-grabbing dark:bg-background-tertiary-default",
        dragging && "opacity-40",
        marker && "before:absolute before:inset-x-2 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-accent-500",
      )}
    >
      <div className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
        {showProject && p && <ProjectIcon p={p} size="sm" />}
        <span className="font-mono">{taskKey(s, t)}</span>
        {t.internal && <RiEyeOffLine className="size-3.5 text-status-purple-text" aria-label="Internal" />}
        <span className="flex-1" />
        <PriorityPick task={t} disabled={!edit} />
      </div>
      <button onClick={() => navigate(withTask(t.id))} className={cx("text-start text-body-medium outline-none hover:underline focus-visible:underline", t.status === "done" ? "text-text-tertiary line-through" : "text-text-primary")}>
        {t.title}
      </button>
      {t.labels.length > 0 && <div className="flex flex-wrap gap-1">{t.labels.map((l) => <LabelChip key={l} id={l} />)}</div>}
      {t.subtasks.length > 0 && (
        <div className="flex items-center gap-2">
          <Progress pct={taskProgress(t)} className="flex-1" />
          <span className="text-caption-1-medium text-text-tertiary tabular-nums">
            {t.subtasks.filter((x) => x.done).length}/{t.subtasks.length}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 text-caption-1-medium text-text-tertiary">
        <DueDate task={t} />
        {comments > 0 && (
          <span className="flex items-center gap-0.5">
            <RiChat3Line className="size-3.5" aria-hidden />
            {comments}
          </span>
        )}
        {files > 0 && (
          <span className="flex items-center gap-0.5">
            <RiAttachment2 className="size-3.5" aria-hidden />
            {files}
          </span>
        )}
        <span className="flex-1" />
        <AssigneePick task={t} disabled={!edit} />
      </div>
    </article>
  );
}

function AddCard({ projectId, set }: { projectId?: string; set: Partial<Task> }) {
  const s = useSnap();
  const [title, setTitle] = useState<string | null>(null);
  if (!projectId || !canEdit(projectOf(s, projectId))) return null;
  if (title === null)
    return (
      <button onClick={() => setTitle("")} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-body-medium text-text-tertiary hover:bg-background-secondary-hover hover:text-text-primary">
        <RiAddLine className="size-4" aria-hidden /> Add card
      </button>
    );
  return (
    <textarea
      autoFocus
      rows={2}
      value={title}
      aria-label="New card title"
      placeholder="Title, then Enter"
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => !title && setTitle(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") return setTitle(null);
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (title.trim()) void createTask({ project_id: projectId, ...set, title: title.trim() });
        setTitle("");
      }}
      className="resize-none rounded-2xl border border-border-button-active bg-background-primary-default p-3 text-body-medium text-text-primary outline-none dark:bg-background-tertiary-default"
    />
  );
}

