import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { cx } from "@/utils/cx";
import { RiAddLine, RiCloseLine, RiLock2Line, RiMoreFill, RiShareLine, RiStarFill, RiStarLine } from "@remixicon/react";
import { PSTAT } from "../constants";
import { ActivityList, Progress, Thread } from "../overlays/drawer";
import { openContextMenu } from "../overlays/layer";
import { confirm, milestoneModal, newTask, shareModal } from "../overlays/modals";
import { DatePick, Pick, peopleOptions } from "../overlays/pickers";
import { RichEditor } from "../rich";
import { navigate, to, useRoute, withTask } from "../router";
import { canEdit, isFav, isOver, personOf, progressOf, projectOf, remove, save, tasksOf, toggleFavorite, useSnap } from "../store";
import type { Project, Snapshot } from "../types";
import { AvatarStack, Card, Empty, PersonAvatar, ProjectIcon, ProjectStatusChip, StatusIcon, fmtDay, relDay } from "../ui";
import { Board } from "../views/board";
import { Calendar } from "../views/calendar";
import { Toolbar, applyView, useView } from "../views/engine";
import { FilesView } from "../views/files";
import { TaskList } from "../views/list";
import { ProcessView, stageState } from "../views/process";
import { TaskTable } from "../views/table";
import { Timeline } from "../views/timeline";
import { projectMenu } from "./projects";
import { RiLock2Fill } from "@remixicon/react";

const TABS = [
  ["overview", "Overview"],
  ["process", "Process"],
  ["board", "Board"],
  ["list", "List"],
  ["table", "Table"],
  ["calendar", "Calendar"],
  ["timeline", "Timeline"],
  ["files", "Files"],
  ["activity", "Activity"],
] as const;

export function ProjectPage() {
  const route = useRoute();
  const s = useSnap();
  const p = projectOf(s, route.id);
  const locked = s.projects.find((x) => x.id === route.id && x.locked);
  if (!p)
    return (
      <Empty
        icon={locked ? RiLock2Fill : RiLock2Line}
        title={locked ? "This project is private" : "Project not found"}
        body={locked ? "Ask the project lead or an admin to add you." : "It may have been deleted, or you don't have access."}
        action={<Button variant="secondary" onClick={() => navigate(to(s.org.slug, "projects"))}>All projects</Button>}
      />
    );
  const engagement = s.stages.some((x) => x.project_id === p.id);
  const tabs = TABS.filter(([k]) => k !== "process" || engagement);
  const views = s.views.filter((v) => v.project_id === p.id);
  const tab = route.tab ?? (engagement ? "process" : "overview");
  return (
    <>
      <Header p={p} s={s} />
      <div role="tablist" aria-label="Project views" className="mb-5 flex gap-1 overflow-x-auto border-b border-separator-border px-4 sm:px-8">
        {tabs.map(([k, label]) => (
          <a key={k} role="tab" aria-selected={tab === k} href={to(s.org.slug, `projects/${p.id}/${k}`)} onClick={(e) => (e.preventDefault(), navigate(to(s.org.slug, `projects/${p.id}/${k}`)))} className={cx("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-body-medium", tab === k ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}>
            {label}
            {k === "process" && <ProcessBadge p={p} s={s} />}
          </a>
        ))}
        {views.map((v) => (
          <span key={v.id} className={cx("group -mb-px flex shrink-0 items-center gap-1 border-b-2 px-2.5 pb-2.5", tab === `v:${v.id}` ? "border-accent-500" : "border-transparent")}>
            <a role="tab" aria-selected={tab === `v:${v.id}`} href={to(s.org.slug, `projects/${p.id}/v:${v.id}`)} onClick={(e) => (e.preventDefault(), navigate(to(s.org.slug, `projects/${p.id}/v:${v.id}`)))} className={cx("text-body-medium", tab === `v:${v.id}` ? "text-text-primary" : "text-text-secondary hover:text-text-primary")}>
              {v.name}
            </a>
            <button aria-label={`Delete view ${v.name}`} onClick={() => confirm({ title: `Delete the “${v.name}” view?`, action: "Delete", danger: true }).then((ok) => ok && (remove("view", v.id), navigate(to(s.org.slug, `projects/${p.id}/list`), { replace: true })))} className="invisible text-foreground-icon-tertiary group-hover:visible">
              <RiCloseLine className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <Tab key={tab} p={p} s={s} tab={tab} />
    </>
  );
}

function ProcessBadge({ p, s }: { p: Project; s: Snapshot }) {
  const waiting = s.stages.filter((x) => x.project_id === p.id && stageState(s, x) === "waiting-client").length;
  return waiting ? <span className="size-2 rounded-full bg-status-orange-text" aria-label="Waiting on a sign-off" /> : null;
}

function Header({ p, s }: { p: Project; s: Snapshot }) {
  const fav = isFav(s, "project", p.id);
  const full = p.perm === "full";
  const people = [...new Set([p.lead_id, ...Object.keys(p.members)])].map((id) => personOf(s, id));
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-6 pb-4 sm:px-8">
      <ProjectIcon p={p} size="lg" />
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 truncate text-title-2-medium text-text-primary">
          {p.name}
          {p.private && <RiLock2Line className="size-4 text-foreground-icon-tertiary" aria-label="Private" />}
        </h1>
        <p className="text-caption-1-medium text-text-tertiary">
          {p.key} · {s.org.name}
        </p>
      </div>
      <IconButton icon={fav ? RiStarFill : RiStarLine} size="small" aria-label={fav ? "Unfavorite" : "Favorite"} aria-pressed={fav} onClick={() => toggleFavorite("project", p.id)} className={cx(fav && "text-status-yellow-text")} />
      <Pick label="Project status" disabled={!full} options={Object.entries(PSTAT).map(([id, v]) => ({ id, label: v.name }))} value={p.status} onChange={(status) => save("project", p.id, { status: status as Project["status"] })}>
        <ProjectStatusChip status={p.status} />
      </Pick>
      <span className="flex-1" />
      <AvatarStack people={people} />
      {full && (
        <Button size="small" variant="secondary" leadingIcon={RiShareLine} onClick={() => shareModal(p)}>
          Share
        </Button>
      )}
      {canEdit(p) && (
        <Button size="small" leadingIcon={RiAddLine} onClick={() => newTask({ project_id: p.id })}>
          Task
        </Button>
      )}
      <IconButton icon={RiMoreFill} size="small" aria-label="Project options" onClick={(e) => openContextMenu(e, projectMenu(s, p))} />
    </div>
  );
}

function Tab({ p, s, tab }: { p: Project; s: Snapshot; tab: string }) {
  const view = tab.startsWith("v:") ? s.views.find((v) => v.id === tab.slice(2)) : null;
  const type = view?.type ?? tab;
  const [v, set] = useView(`project:${p.id}:${view?.id ?? type}`, { group: "status", filters: view?.filters ?? [] });
  const tasks = applyView(s, tasksOf(s, p.id), v);

  if (tab === "overview") return <OverviewTab p={p} s={s} />;
  if (tab === "process") return <ProcessView p={p} />;
  if (tab === "files") return <FilesView projectId={p.id} />;
  if (tab === "activity")
    return (
      <div className="px-4 sm:px-8">
        <Card>
          <ActivityList items={s.activity.filter((a) => a.project_id === p.id)} s={s} footer={`Project created ${fmtDay(new Date(p.created_at).toLocaleDateString("en-CA"))}`} />
        </Card>
      </div>
    );
  if (!["board", "list", "table", "calendar", "timeline"].includes(type)) return <Empty title="That view doesn't exist" />;
  const viewType = type as "board" | "list" | "table" | "calendar" | "timeline";
  return (
    <div className="flex flex-col gap-4">
      <Toolbar s={s} v={v} set={set} projectId={p.id} viewType={view ? undefined : viewType} group={viewType === "board" || viewType === "list" || viewType === "timeline"} hideFields={["project"]} />
      {viewType === "board" && <Board tasks={tasks} group={v.group} projectId={p.id} />}
      {viewType === "list" && <TaskList tasks={tasks} group={v.group} projectId={p.id} collapseKey={`p:${p.id}`} />}
      {viewType === "table" && <TaskTable tasks={tasks} />}
      {viewType === "calendar" && <Calendar tasks={tasks} events={s.events.filter((e) => e.project_id === p.id)} projectId={p.id} />}
      {viewType === "timeline" && <Timeline tasks={tasks} group={v.group} milestones={p.milestones} projects={[p]} />}
    </div>
  );
}

function OverviewTab({ p, s }: { p: Project; s: Snapshot }) {
  const full = p.perm === "full";
  const tasks = tasksOf(s, p.id);
  const pct = progressOf(s, p.id);
  const coming = tasks.filter((t) => t.status !== "done" && t.due).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 6);
  const team = s.teams.find((t) => t.id === p.team_id);
  const lead = personOf(s, p.lead_id);
  const counts = { open: tasks.filter((t) => t.status !== "done").length, done: tasks.filter((t) => t.status === "done").length, late: tasks.filter(isOver).length };
  return (
    <div className="grid gap-5 px-4 sm:px-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Card title="About">
          <RichEditor label="Project description" value={p.description} disabled={!full} people={s.people} placeholder={full ? "What is this project about? Goals, scope, links…" : "No description."} onCommit={(description) => save("project", p.id, { description })} />
        </Card>
        <Card title="Progress">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-title-1-medium text-text-primary tabular-nums">{pct}%</span>
              <span className="text-body-regular text-text-secondary">
                {counts.done} done · {counts.open} open{counts.late ? ` · ${counts.late} overdue` : ""}
              </span>
            </div>
            <Progress pct={pct} />
          </div>
        </Card>
        <Card title="Coming up">
          {coming.length ? (
            <ul className="flex flex-col">
              {coming.map((t) => (
                <li key={t.id}>
                  <button onClick={() => navigate(withTask(t.id))} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-start hover:bg-background-secondary-default">
                    <StatusIcon status={t.status} />
                    <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{t.title}</span>
                    <span className={cx("text-body-2-medium", isOver(t) ? "text-text-error-primary" : "text-text-secondary")}>{relDay(t.due!)}</span>
                    <PersonAvatar person={personOf(s, t.assignee_id)} size="xs" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-regular text-text-tertiary">Nothing scheduled.</p>
          )}
        </Card>
        <Card title="Discussion">
          <Thread projectId={p.id} />
        </Card>
      </div>
      <div className="flex flex-col gap-5">
        <Card title="Details">
          <dl className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-y-1.5">
            <dt className="text-body-medium text-text-secondary">Lead</dt>
            <dd>
              <Pick label="Lead" disabled={!full} options={peopleOptions(s.people, "No lead")} value={p.lead_id ?? ""} onChange={(id) => save("project", p.id, { lead_id: id || null })}>
                <PersonAvatar person={lead} size="xs" />
                <span className="text-body-medium text-text-primary">{lead?.name ?? "No lead"}</span>
              </Pick>
            </dd>
            <dt className="text-body-medium text-text-secondary">Team</dt>
            <dd>
              <Pick label="Team" disabled={!full} options={[{ id: "", label: "No team" }, ...s.teams.map((t) => ({ id: t.id, label: t.name }))]} value={p.team_id ?? ""} onChange={(id) => save("project", p.id, { team_id: id || null })}>
                <span className="text-body-medium text-text-primary">{team?.name ?? "No team"}</span>
              </Pick>
            </dd>
            <dt className="text-body-medium text-text-secondary">Start</dt>
            <dd>
              <DatePick value={p.start} label="Start date" disabled={!full} onChange={(start) => save("project", p.id, { start })} />
            </dd>
            <dt className="text-body-medium text-text-secondary">Target</dt>
            <dd>
              <DatePick value={p.due} label="Target date" disabled={!full} onChange={(due) => save("project", p.id, { due })} />
            </dd>
            <dt className="text-body-medium text-text-secondary">Access</dt>
            <dd className="px-1.5 text-body-medium text-text-primary">{p.private ? "Private" : `Everyone in ${s.org.name}`}</dd>
            <dt className="text-body-medium text-text-secondary">You</dt>
            <dd className="px-1.5 text-body-medium text-text-primary">{{ view: "Can view", comment: "Can comment", edit: "Can edit", full: "Full access" }[p.perm]}</dd>
          </dl>
        </Card>
        <Card title="Milestones" actions={full && <Button size="small" variant="ghost" leadingIcon={RiAddLine} onClick={() => milestoneModal(p)}>Add</Button>}>
          {p.milestones.length ? (
            <ul className="flex flex-col gap-2">
              {[...p.milestones].sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9")).map((m) => (
                <li key={m.id} className="group flex items-center gap-3">
                  <span className="size-2.5 rotate-45 rounded-[2px] bg-accent-500" />
                  <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{m.name}</span>
                  <span className="text-body-2-medium text-text-secondary">{m.date ? fmtDay(m.date) : "No date"}</span>
                  {full && (
                    <button aria-label={`Remove ${m.name}`} onClick={() => save("project", p.id, { milestones: p.milestones.filter((x) => x.id !== m.id) })} className="invisible text-foreground-icon-tertiary group-hover:visible">
                      <RiCloseLine className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-regular text-text-tertiary">No milestones yet.</p>
          )}
        </Card>
        <Card title="Recent activity">
          <ActivityList items={s.activity.filter((a) => a.project_id === p.id).slice(0, 8)} s={s} />
        </Card>
      </div>
    </div>
  );
}
