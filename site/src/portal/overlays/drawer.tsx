import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { IconButton } from "@/components/base/buttons/icon-button";
import { cx } from "@/utils/cx";
import {
  RiAddLine, RiAlarmWarningFill, RiArchiveLine, RiAttachment2, RiCalendarLine, RiCheckboxCircleFill,
  RiCheckboxCircleLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiEmotionLine, RiEyeOffLine,
  RiFlowChart, RiFolderLine, RiFullscreenExitLine, RiFullscreenLine, RiLinksLine, RiMoreFill,
  RiPriceTag3Line, RiProgress4Line, RiRepeat2Line, RiShieldLine, RiSignalWifi3Line, RiStarFill,
  RiStarLine, RiTimerLine, RiUploadCloud2Line, RiUserLine, RiGitBranchLine,
} from "@remixicon/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fileUrl } from "../api";
import { RichEditor, isEmptyHtml } from "../rich";
import { navigate, to, useRoute, withTask } from "../router";
import {
  archive, canComment, canEdit, comment, isFav, isOver, personOf, projectOf, react, remove, save,
  setTaskStatus, taskKey, taskOf, toast, toggleFavorite, uploadFiles, useSnap,
} from "../store";
import type { Comment, Snapshot, Task } from "../types";
import { FileIcon, Link, PersonAvatar, ProjectIcon, Rich, dayDiff, fmtSize, timeAgo } from "../ui";
import { openContextMenu, type MenuItem } from "./layer";
import { AssigneePick, DatePick, LabelsPick, Pick, PriorityPick, ProjectPick, RecurPick, StatusPick } from "./pickers";
import { confirm, filePreview } from "./modals";

const EMOJI = ["👍", "❤️", "🎉", "😄", "👀", "🚀"];

/** The right-hand task panel, opened by `?task=` on any console URL. */
export function TaskDrawer() {
  const route = useRoute();
  const s = useSnap();
  const t = taskOf(s, route.task);
  const [full, setFull] = useState(() => localStorage.getItem("console:drawer-full") === "1");
  const close = () => navigate(withTask(null));

  if (!route.task) return null;
  if (!t) return null;
  const p = projectOf(s, t.project_id);
  return (
    <>
      {full && <div className="fixed inset-0 z-40 bg-black/50" onClick={close} aria-hidden />}
      <aside
        role="dialog"
        aria-label={`Task: ${t.title}`}
        className={cx(
          "fixed z-40 flex flex-col overflow-hidden border border-border-button-default bg-background-primary-default shadow-xl dark:bg-background-secondary-default",
          full ? "inset-4 mx-auto max-w-[1040px] rounded-3xl sm:inset-8" : "inset-y-0 end-0 w-full sm:inset-y-3 sm:end-3 sm:w-[min(560px,calc(100vw-1.5rem))] sm:rounded-3xl",
        )}
      >
        <DrawerHeader t={t} s={s} full={full} onFull={() => (setFull(!full), localStorage.setItem("console:drawer-full", full ? "0" : "1"))} onClose={close} />
        <div key={t.id} className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
          <TaskBody t={t} s={s} editable={canEdit(p)} full={full} />
        </div>
      </aside>
    </>
  );
}

export function taskMenu(s: Snapshot, t: Task): MenuItem[] {
  const p = projectOf(s, t.project_id);
  const edit = canEdit(p);
  return [
    { label: "Open", icon: RiFullscreenLine, onSelect: () => navigate(withTask(t.id)) },
    { label: "Copy link", icon: RiLinksLine, onSelect: () => copyLink(s, t) },
    { label: isFav(s, "task", t.id) ? "Unfavorite" : "Favorite", icon: RiStarLine, onSelect: () => toggleFavorite("task", t.id) },
    { label: t.status === "done" ? "Reopen" : "Mark complete", icon: RiCheckboxCircleLine, onSelect: () => setTaskStatus(t, t.status === "done" ? "todo" : "done"), disabled: !edit, divider: true },
    ...(s.viewer.staff
      ? [{ label: t.internal ? "Share with client" : "Make internal", icon: RiEyeOffLine, onSelect: () => save("task", t.id, { internal: !t.internal }) }]
      : []),
    { label: "Archive", icon: RiArchiveLine, onSelect: () => archive("task", t.id, t.title), disabled: !edit, divider: true },
    {
      label: "Delete",
      icon: RiDeleteBinLine,
      danger: true,
      disabled: !edit,
      onSelect: () =>
        confirm({ title: `Delete ${taskKey(s, t)}?`, body: "The task, its comments and its attachments are removed for everyone. This can't be undone.", action: "Delete task", danger: true }).then(
          (ok) => ok && (navigate(withTask(null), { replace: true }), remove("task", t.id)),
        ),
    },
  ];
}

const copyLink = (s: Snapshot, t: Task) =>
  navigator.clipboard.writeText(`${location.origin}${to(s.org.slug, `projects/${t.project_id}`)}?task=${t.id}`).then(() => toast("Link copied"));

function DrawerHeader({ t, s, full, onFull, onClose }: { t: Task; s: Snapshot; full: boolean; onFull: () => void; onClose: () => void }) {
  const p = projectOf(s, t.project_id);
  const done = t.status === "done";
  const fav = isFav(s, "task", t.id);
  return (
    <header className="flex items-center gap-1 border-b border-separator-border px-3 py-2.5 sm:px-4">
      {p && (
        <Link href={to(s.org.slug, `projects/${p.id}/board`)} className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-body-2-medium text-text-secondary hover:bg-background-secondary-hover">
          <ProjectIcon p={p} size="sm" />
          <span className="truncate">{p.name}</span>
        </Link>
      )}
      <span className="text-text-tertiary">/</span>
      <span className="shrink-0 px-1.5 font-mono text-caption-1-medium whitespace-nowrap text-text-tertiary">{taskKey(s, t)}</span>
      {t.internal && (
        <span className="ms-1 inline-flex items-center gap-1 rounded-md bg-status-purple-background px-1.5 py-0.5 text-caption-1-medium text-status-purple-text" title="Only StayonSite can see this task">
          <RiShieldLine className="size-3" aria-hidden /> Internal
        </span>
      )}
      <span className="flex-1" />
      <Button
        size="small"
        variant={done ? "secondary" : "ghost"}
        leadingIcon={done ? RiCheckboxCircleFill : RiCheckboxCircleLine}
        disabled={!canEdit(p)}
        onClick={() => setTaskStatus(t, done ? "todo" : "done")}
        className={cx(done && "text-status-lime-text")}
      >
        <span className="hidden sm:inline">{done ? "Completed" : "Mark complete"}</span>
      </Button>
      <IconButton icon={fav ? RiStarFill : RiStarLine} size="small" aria-label={fav ? "Unfavorite" : "Favorite"} aria-pressed={fav} onClick={() => toggleFavorite("task", t.id)} className={cx(fav && "text-status-yellow-text")} />
      <IconButton icon={RiLinksLine} size="small" aria-label="Copy link" onClick={() => copyLink(s, t)} />
      <IconButton icon={full ? RiFullscreenExitLine : RiFullscreenLine} size="small" aria-label={full ? "Side panel" : "Full page"} onClick={onFull} className="hidden sm:inline-flex" />
      <IconButton icon={RiMoreFill} size="small" aria-label="More" onClick={(e) => openContextMenu(e, taskMenu(s, t))} />
      <IconButton icon={RiCloseLine} size="small" aria-label="Close" onClick={onClose} />
    </header>
  );
}

function Prop({ icon: Icon, label, children }: { icon: typeof RiUserLine; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 py-1.5 text-body-medium text-text-secondary">
        <Icon className="size-4 text-foreground-icon-tertiary" aria-hidden />
        {label}
      </dt>
      <dd className="flex min-w-0 items-center py-0.5">{children}</dd>
    </>
  );
}

function TaskBody({ t, s, editable, full }: { t: Task; s: Snapshot; editable: boolean; full: boolean }) {
  const [title, setTitle] = useState(t.title);
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  useEffect(() => setTitle(t.title), [t.title]);
  const p = projectOf(s, t.project_id);
  const stages = s.stages.filter((x) => x.project_id === t.project_id);
  const otherTasks = s.tasks.filter((x) => x.id !== t.id && !x.archived);
  const commentsCount = s.comments.filter((c) => c.task_id === t.id).length;
  const activity = s.activity.filter((a) => a.task_id === t.id);

  return (
    <div className="flex flex-col gap-6 pt-4">
      {t.status === "done" ? (
        <Banner tone="ok" icon={RiCheckboxCircleFill}>
          Completed {t.completed_at ? timeAgo(t.completed_at) : ""}.{" "}
          {editable && (
            <button className="underline" onClick={() => setTaskStatus(t, "todo")}>
              Reopen task
            </button>
          )}
        </Banner>
      ) : isOver(t) ? (
        <Banner tone="danger" icon={RiAlarmWarningFill}>
          Overdue by {-dayDiff(t.due!)} day{dayDiff(t.due!) === -1 ? "" : "s"}.
        </Banner>
      ) : null}

      <textarea
        aria-label="Task title"
        value={title}
        rows={1}
        readOnly={!editable}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
        onBlur={() => title.trim() && title.trim() !== t.title ? save("task", t.id, { title: title.trim() }) : setTitle(t.title)}
        className="field-sizing-content w-full resize-none bg-transparent text-title-2-medium text-text-primary outline-none"
      />

      <dl className={cx("grid items-center gap-x-4", full ? "grid-cols-[120px_minmax(0,1fr)_120px_minmax(0,1fr)]" : "grid-cols-[120px_minmax(0,1fr)]")}>
        <Prop icon={RiProgress4Line} label="Status"><StatusPick task={t} disabled={!editable} showLabel /></Prop>
        <Prop icon={RiSignalWifi3Line} label="Priority"><PriorityPick task={t} disabled={!editable} showLabel /></Prop>
        <Prop icon={RiUserLine} label="Assignee"><AssigneePick task={t} disabled={!editable} showLabel /></Prop>
        <Prop icon={RiCalendarLine} label="Due date"><DatePick task={t} value={t.due} label="Due date" disabled={!editable} onChange={(due) => save("task", t.id, { due })} /></Prop>
        <Prop icon={RiCalendarLine} label="Start date"><DatePick value={t.start} label="Start date" disabled={!editable} onChange={(start) => save("task", t.id, { start })} /></Prop>
        <Prop icon={RiFolderLine} label="Project"><ProjectPick task={t} disabled={!editable} /></Prop>
        <Prop icon={RiPriceTag3Line} label="Labels"><LabelsPick task={t} disabled={!editable} /></Prop>
        <Prop icon={RiRepeat2Line} label="Repeat"><RecurPick task={t} disabled={!editable} /></Prop>
        <Prop icon={RiTimerLine} label="Estimate"><Estimate t={t} editable={editable} /></Prop>
        <Prop icon={RiGitBranchLine} label="Blocked by">
          <Pick
            label="Blocked by"
            multi
            disabled={!editable}
            options={otherTasks.map((x) => ({ id: x.id, label: `${taskKey(s, x)} ${x.title}` }))}
            value={t.deps}
            onChange={(id) => save("task", t.id, { deps: t.deps.includes(id) ? t.deps.filter((d) => d !== id) : [...t.deps, id] })}
          >
            {t.deps.length ? (
              <span className="flex flex-wrap gap-1">
                {t.deps.map((d) => {
                  const dep = taskOf(s, d);
                  return dep ? (
                    <span key={d} className={cx("rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium", dep.status === "done" ? "text-text-tertiary line-through" : "text-text-secondary")}>
                      {taskKey(s, dep)}
                    </span>
                  ) : null;
                })}
              </span>
            ) : (
              <span className="text-body-medium text-text-tertiary">Nothing</span>
            )}
          </Pick>
        </Prop>
        {stages.length > 0 && (
          <Prop icon={RiFlowChart} label="Stage">
            <Pick
              label="Stage"
              disabled={!editable}
              options={[{ id: "", label: "No stage" }, ...stages.map((x) => ({ id: x.id, label: `${x.n}. ${x.name}` }))]}
              value={t.stage_id ?? ""}
              onChange={(id) => save("task", t.id, { stage_id: id || null })}
            >
              <span className={cx("text-body-medium", t.stage_id ? "text-text-primary" : "text-text-tertiary")}>
                {stages.find((x) => x.id === t.stage_id)?.name ?? "No stage"}
              </span>
            </Pick>
          </Prop>
        )}
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-headline-medium text-text-primary">Description</h3>
        <RichEditor
          label="Description"
          value={t.description}
          disabled={!editable}
          people={s.people}
          placeholder={editable ? "Add a description… type @ to mention" : "No description"}
          onCommit={(description) => save("task", t.id, { description })}
        />
      </section>

      <Subtasks t={t} editable={editable} />
      <Attachments t={t} s={s} editable={canComment(p)} />

      <section className="flex flex-col gap-3">
        <div role="tablist" className="flex gap-1 border-b border-separator-border">
          {(
            [
              ["comments", "Comments", commentsCount],
              ["activity", "Activity", activity.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx("-mb-px flex items-center gap-1.5 border-b-2 px-2 pb-2 text-body-medium outline-none", tab === k ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
            >
              {label}
              <span className="rounded-sm bg-background-tertiary-default px-1 text-caption-1-medium text-text-tertiary">{n}</span>
            </button>
          ))}
        </div>
        {tab === "comments" ? (
          <Thread projectId={t.project_id} taskId={t.id} internal={t.internal} />
        ) : (
          <ActivityList items={activity} s={s} footer={`Task created ${timeAgo(t.created_at)}`} />
        )}
      </section>
    </div>
  );
}

function Banner({ tone, icon: Icon, children }: { tone: "ok" | "danger"; icon: typeof RiAlarmWarningFill; children: ReactNode }) {
  return (
    <div className={cx("flex items-center gap-2 rounded-2xl px-3 py-2 text-body-medium", tone === "ok" ? "bg-status-lime-background text-status-lime-text" : "bg-status-rose-background text-status-rose-text")}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function Estimate({ t, editable }: { t: Task; editable: boolean }) {
  const [v, setV] = useState(t.estimate ?? "");
  useEffect(() => setV(t.estimate ?? ""), [t.estimate]);
  return (
    <input
      aria-label="Estimate"
      value={v}
      readOnly={!editable}
      maxLength={20}
      placeholder={editable ? "e.g. 2h, 1d" : "None"}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={() => v.trim() !== (t.estimate ?? "") && save("task", t.id, { estimate: v.trim() || null })}
      className="w-40 rounded-lg bg-transparent px-1.5 py-1 text-body-medium text-text-primary outline-none placeholder:text-text-tertiary hover:bg-background-secondary-hover focus:bg-background-secondary-hover"
    />
  );
}

function Subtasks({ t, editable }: { t: Task; editable: boolean }) {
  const [draft, setDraft] = useState("");
  const done = t.subtasks.filter((x) => x.done).length;
  const set = (subtasks: Task["subtasks"]) => save("task", t.id, { subtasks });
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-headline-medium text-text-primary">Subtasks</h3>
        <span className="text-body-2-medium text-text-tertiary tabular-nums">
          {done}/{t.subtasks.length}
        </span>
        {t.subtasks.length > 0 && <Progress pct={Math.round((done / t.subtasks.length) * 100)} className="w-24" />}
      </div>
      <ul className="flex flex-col">
        {t.subtasks.map((x) => (
          <li key={x.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-background-secondary-hover">
            <Checkbox size="sm" isSelected={x.done} isDisabled={!editable} aria-label={`${x.done ? "Reopen" : "Complete"} ${x.title}`} onChange={(v) => set(t.subtasks.map((y) => (y.id === x.id ? { ...y, done: v } : y)))} />
            <input
              defaultValue={x.title}
              readOnly={!editable}
              aria-label="Subtask"
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== x.title && set(t.subtasks.map((y) => (y.id === x.id ? { ...y, title: e.target.value.trim() } : y)))}
              className={cx("min-w-0 flex-1 bg-transparent text-body-regular outline-none", x.done ? "text-text-tertiary line-through" : "text-text-primary")}
            />
            {editable && (
              <button aria-label="Remove subtask" onClick={() => set(t.subtasks.filter((y) => y.id !== x.id))} className="invisible rounded p-0.5 text-foreground-icon-tertiary group-hover:visible hover:text-text-primary">
                <RiCloseLine className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
        {editable && (
          <li className="flex items-center gap-2 px-1 py-1">
            <RiAddLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
            <input
              value={draft}
              aria-label="Add subtask"
              placeholder="Add subtask"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !draft.trim()) return;
                set([...t.subtasks, { id: crypto.randomUUID(), title: draft.trim(), done: false }]);
                setDraft("");
              }}
              className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </li>
        )}
      </ul>
    </section>
  );
}

export function Progress({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cx("block h-1.5 overflow-hidden rounded-full bg-background-tertiary-default", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={cx("block h-full rounded-full transition-[width] duration-300", pct === 100 ? "bg-status-lime-text" : "bg-accent-500")} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Drop zone + list of files on a task (or a stage), with live upload progress. */
export function Attachments({ t, s, editable, stageId, projectId, title = "Attachments" }: { t?: Task; s: Snapshot; editable: boolean; stageId?: string; projectId?: string; title?: string }) {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const files = s.files.filter((f) => (t ? f.task_id === t.id : f.stage_id === stageId));
  const go = (list: FileList | null) => {
    if (!list?.length) return;
    void uploadFiles([...list], { project: t?.project_id ?? projectId, task: t?.id, stage: stageId }, (name, pct) => setProgress((p) => ({ ...p, [name]: pct }))).then(() => setProgress({}));
  };
  return (
    <section
      className={cx("flex flex-col gap-2 rounded-2xl transition-colors", over && "bg-background-secondary-hover outline-2 outline-dashed outline-border-button-active")}
      onDragOver={(e) => editable && (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (editable) go(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-3">
        <h3 className="text-headline-medium text-text-primary">{title}</h3>
        <span className="text-body-2-medium text-text-tertiary">{files.length}</span>
        <span className="flex-1" />
        {editable && (
          <>
            <Button size="small" variant="ghost" leadingIcon={RiUploadCloud2Line} onClick={() => input.current?.click()}>
              Upload
            </Button>
            <input ref={input} type="file" multiple hidden onChange={(e) => (go(e.target.files), (e.target.value = ""))} />
          </>
        )}
      </div>
      {Object.entries(progress).map(([name, pct]) => (
        <div key={name} className="flex items-center gap-3 rounded-xl border border-border-button-default px-3 py-2">
          <RiAttachment2 className="size-4 text-foreground-icon-tertiary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{name}</span>
          <Progress pct={pct} className="w-24" />
        </div>
      ))}
      {files.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => filePreview(f, s)}
              onContextMenu={(e) =>
                openContextMenu(e, [
                  { label: "Download", icon: RiUploadCloud2Line, onSelect: () => (location.href = fileUrl(f.id, true)) },
                  { label: "Delete", icon: RiDeleteBinLine, danger: true, onSelect: () => remove("file", f.id) },
                ])
              }
              className="flex flex-col overflow-hidden rounded-xl border border-border-button-default text-start outline-none hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <span className="flex h-20 items-center justify-center bg-background-tertiary-default">
                {f.type.startsWith("image/") ? <img src={fileUrl(f.id)} alt="" loading="lazy" className="size-full object-cover" /> : <FileIcon type={f.type} name={f.name} className="size-7" />}
              </span>
              <span className="flex flex-col px-2.5 py-2">
                <span className="truncate text-body-2-medium text-text-primary">{f.name}</span>
                <span className="text-caption-1-medium text-text-tertiary">
                  {fmtSize(f.size)}
                  {f.internal && " · Internal"}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        !Object.keys(progress).length && <p className="text-body-regular text-text-tertiary">{editable ? "Drop files here, or upload." : "No files."}</p>
      )}
    </section>
  );
}

/** Comments on a task, a stage, or the project itself. */
export function Thread({ projectId, taskId, stageId, internal = false }: { projectId: string; taskId?: string; stageId?: string; internal?: boolean }) {
  const s = useSnap();
  const p = projectOf(s, projectId);
  const list = s.comments.filter((c) => c.project_id === projectId && (taskId ? c.task_id === taskId : stageId ? c.stage_id === stageId : !c.task_id && !c.stage_id));
  const [key, setKey] = useState(0);
  const [asInternal, setAsInternal] = useState(false);
  const me = personOf(s, s.viewer.id);
  const post = (html: string) => {
    if (isEmptyHtml(html)) return;
    void comment({ project_id: projectId, task_id: taskId ?? null, stage_id: stageId ?? null, body: html, internal: internal || asInternal });
    setKey((k) => k + 1);
  };
  const editor = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-4">
      {list.length ? list.map((c) => <CommentRow key={c.id} c={c} s={s} />) : <p className="text-body-regular text-text-tertiary">No comments yet. Start the conversation.</p>}
      {canComment(p) && (
        <div className="flex items-start gap-3">
          <PersonAvatar person={me} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <RichEditor key={key} editorRef={editor} label="Comment" value="" toolbar={false} minHeight="min-h-16" people={s.people} placeholder="Leave a comment… type @ to mention" onSubmit={post} />
            <div className="flex items-center gap-2">
              {s.viewer.staff && !internal && (
                <Checkbox size="sm" isSelected={asInternal} onChange={setAsInternal}>
                  Internal note
                </Checkbox>
              )}
              <span className="flex-1 text-caption-1-medium text-text-tertiary">⌘ Enter to send</span>
              <Button size="small" onClick={() => post(editor.current?.innerHTML ?? "")}>
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ c, s }: { c: Comment; s: Snapshot }) {
  const who = personOf(s, c.author_id);
  const mine = c.author_id === s.viewer.id;
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  return (
    <article className={cx("group flex gap-3", c.internal && "rounded-2xl bg-status-purple-background/40 p-2")}>
      <PersonAvatar person={who} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-body-medium text-text-primary">{who?.name ?? "Former member"}</span>
          {who?.staff && <span className="text-caption-1-medium text-text-tertiary">StayonSite</span>}
          <time className="text-caption-1-medium text-text-tertiary" title={new Date(c.created_at).toLocaleString()}>
            {timeAgo(c.created_at)}
            {c.edited_at && " · edited"}
          </time>
          {c.internal && <span className="text-caption-1-medium text-status-purple-text">Internal</span>}
          <span className="flex-1" />
          {mine && !editing && (
            <span className="invisible flex gap-0.5 group-hover:visible">
              <IconButton icon={RiEditLine} size="small" aria-label="Edit comment" onClick={() => setEditing(true)} />
              <IconButton icon={RiDeleteBinLine} size="small" aria-label="Delete comment" onClick={() => remove("comment", c.id)} />
            </span>
          )}
        </div>
        {editing ? (
          <RichEditor
            label="Edit comment"
            value={c.body}
            toolbar={false}
            autoFocus
            people={s.people}
            onSubmit={(body) => (save("comment", c.id, { body }), setEditing(false))}
            onCommit={(body) => (body && body !== c.body && save("comment", c.id, { body }), setEditing(false))}
          />
        ) : (
          <Rich html={c.body} />
        )}
        <div className="flex flex-wrap items-center gap-1">
          {Object.entries(c.reactions).map(([e, ids]) => (
            <button
              key={e}
              onClick={() => react(c, e)}
              title={ids.map((id) => personOf(s, id)?.name ?? "someone").join(", ")}
              className={cx("flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption-1-medium", ids.includes(s.viewer.id) ? "border-accent-500 bg-accent-500/10 text-text-primary" : "border-border-button-default text-text-secondary")}
            >
              {e} <span className="tabular-nums">{ids.length}</span>
            </button>
          ))}
          <span className="relative">
            <button aria-label="Add reaction" onClick={() => setPicking(!picking)} className="invisible rounded-full p-1 text-foreground-icon-tertiary group-hover:visible hover:bg-background-secondary-hover focus-visible:visible">
              <RiEmotionLine className="size-4" aria-hidden />
            </button>
            {picking && (
              <span className="absolute start-0 top-full z-10 mt-1 flex gap-0.5 rounded-full border border-border-button-default bg-background-primary-default p-1 shadow-dropdown">
                {EMOJI.map((e) => (
                  <button key={e} onClick={() => (react(c, e), setPicking(false))} className="rounded-full px-1.5 py-0.5 hover:bg-background-secondary-hover" aria-label={`React ${e}`}>
                    {e}
                  </button>
                ))}
              </span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ActivityList({ items, s, footer, showProject = false }: { items: Snapshot["activity"]; s: Snapshot; footer?: string; showProject?: boolean }) {
  return (
    <ol className="flex flex-col">
      {items.map((a) => {
        const who = personOf(s, a.actor_id);
        const task = taskOf(s, a.task_id);
        const p = projectOf(s, a.project_id);
        return (
          <li key={a.id} className="flex items-start gap-3 py-1.5">
            <PersonAvatar person={who} size="sm" />
            <p className="min-w-0 flex-1 text-body-regular text-text-secondary">
              <span className="text-body-medium text-text-primary">{a.actor_id === s.viewer.id ? "You" : (who?.name ?? "Someone")}</span> {a.verb.replace(/ of$/, "")}{" "}
              {task && (
                <Link href={withTask(task.id)} className="text-text-primary hover:underline">
                  {task.title}
                </Link>
              )}{" "}
              {a.data.extra}
              {showProject && p && !task && <span className="text-text-tertiary"> · {p.name}</span>}
              {a.internal && <span className="ms-1 text-caption-1-medium text-status-purple-text">Internal</span>}
            </p>
            <time className="shrink-0 text-caption-1-medium text-text-tertiary">{timeAgo(a.at)}</time>
          </li>
        );
      })}
      {footer && (
        <li className="flex items-center gap-3 py-1.5 text-body-regular text-text-tertiary">
          <span className="flex size-6 items-center justify-center">
            <RiAddLine className="size-4" aria-hidden />
          </span>
          {footer}
        </li>
      )}
      {!items.length && !footer && <li className="py-2 text-body-regular text-text-tertiary">No activity yet.</li>}
    </ol>
  );
}

export const openTask = (id: string) => navigate(withTask(id));
