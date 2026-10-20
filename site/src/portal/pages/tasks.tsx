import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { RiAddLine, RiArchiveLine, RiArrowGoBackLine, RiDeleteBinLine, RiStarLine } from "@remixicon/react";
import { useState } from "react";
import { confirm, newTask } from "../overlays/modals";
import { navigate, to, withTask } from "../router";
import { canEdit, isOver, liveTasks, openProjects, projectOf, remove, save, taskKey, useSnap } from "../store";
import type { Project } from "../types";
import { Card, Empty, Link, PageHeader, ProjectIcon, ProjectStatusChip, StatusIcon, timeAgo } from "../ui";
import { Board } from "../views/board";
import { Toolbar, applyView, useView } from "../views/engine";
import { TaskList } from "../views/list";
import { dayDiff } from "../ui";

function Layout({ id, value, onChange }: { id: string; value: "list" | "board"; onChange: (v: "list" | "board") => void }) {
  return (
    <SegmentedControl aria-label="Layout" selectedKeys={new Set([value])} onSelectionChange={(k) => { const v = [...k][0] as "list" | "board"; if (v) { onChange(v); localStorage.setItem(`console:layout:${id}`, v); } }}>
      <SegmentedControlItem id="list">List</SegmentedControlItem>
      <SegmentedControlItem id="board">Board</SegmentedControlItem>
    </SegmentedControl>
  );
}
const useLayout = (id: string) => useState<"list" | "board">(() => (localStorage.getItem(`console:layout:${id}`) as "list" | "board") ?? "list");

/** Everything assigned to me, bucketed by when it's due. */
export function MyTasks() {
  const s = useSnap();
  const [layout, setLayout] = useLayout("my");
  const [v, set] = useView("my-tasks", { group: "due" });
  const mine = applyView(s, liveTasks(s).filter((t) => t.assignee_id === s.viewer.id), v);
  const today = mine.filter((t) => t.due && dayDiff(t.due) === 0 && t.status !== "done").length;
  const over = mine.filter(isOver).length;
  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle={`${today} due today${over ? ` · ${over} overdue` : ""}`}
        actions={
          <>
            <Layout id="my" value={layout} onChange={setLayout} />
            <Button leadingIcon={RiAddLine} onClick={() => newTask({ assignee_id: s.viewer.id })}>
              New task
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Toolbar s={s} v={v} set={set} hideFields={["assignee"]} />
        {layout === "board" ? <Board tasks={mine} group={v.group === "due" ? "status" : v.group} showProject /> : <TaskList tasks={mine} group={v.group} showProject collapseKey="my" empty={<Empty icon={RiStarLine} title="Nothing assigned to you" body="When someone assigns you a task, it shows up here." />} />}
      </div>
    </>
  );
}

/** Every task you can see, across projects. */
export function Tasks() {
  const s = useSnap();
  const [layout, setLayout] = useLayout("tasks");
  const [v, set] = useView("tasks", { group: "status" });
  const tasks = applyView(s, liveTasks(s), v);
  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} tasks across ${openProjects(s).length} projects`}
        actions={
          <>
            <Layout id="tasks" value={layout} onChange={setLayout} />
            <Button leadingIcon={RiAddLine} onClick={() => newTask()}>
              New task
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Toolbar s={s} v={v} set={set} viewType={layout} />
        {layout === "board" ? <Board tasks={tasks} group={v.group} showProject /> : <TaskList tasks={tasks} group={v.group} showProject collapseKey="tasks" />}
      </div>
    </>
  );
}

export function Favorites() {
  const s = useSnap();
  const projects = s.favorites.filter((f) => f.kind === "project").map((f) => projectOf(s, f.ref_id)).filter(Boolean) as Project[];
  const tasks = liveTasks(s).filter((t) => s.favorites.some((f) => f.kind === "task" && f.ref_id === t.id));
  return (
    <>
      <PageHeader title="Favorites" subtitle="Projects and tasks you starred." />
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        {!projects.length && !tasks.length && <Empty icon={RiStarLine} title="No favorites yet" body="Star a project or a task to keep it one click away." />}
        {projects.length > 0 && (
          <Card title="Projects">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link key={p.id} href={to(s.org.slug, `projects/${p.id}`)} className="flex items-center gap-3 rounded-2xl border border-border-button-default p-3 hover:border-border-button-hover">
                  <ProjectIcon p={p} size="lg" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-body-medium text-text-primary">{p.name}</span>
                    <ProjectStatusChip status={p.status} />
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        {tasks.length > 0 && (
          <Card title="Tasks" padded={false}>
            <div className="pb-3">
              <TaskList tasks={tasks} group="none" showProject collapseKey="fav" />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/** Archived projects and tasks: restore or delete for good. */
export function Archive() {
  const s = useSnap();
  const projects = s.projects.filter((p): p is Project => !p.locked && !!p.archived);
  const tasks = s.tasks.filter((t) => t.archived);
  const gone = (what: string, run: () => void) =>
    confirm({ title: `Delete ${what} for good?`, body: "It's removed for everyone, with everything in it. This can't be undone.", action: "Delete", danger: true }).then((ok) => ok && run());
  return (
    <>
      <PageHeader title="Archive" subtitle="Archived work stays here until you restore it or delete it for good." />
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        {!projects.length && !tasks.length && <Empty icon={RiArchiveLine} title="The archive is empty" />}
        {projects.length > 0 && (
          <Card title="Projects">
            <ul className="flex flex-col">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-separator-border py-2.5 last:border-b-0">
                  <ProjectIcon p={p} />
                  <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{p.name}</span>
                  <span className="text-caption-1-medium text-text-tertiary">archived {timeAgo(p.archived)}</span>
                  {p.perm === "full" && (
                    <>
                      <Button size="small" variant="secondary" leadingIcon={RiArrowGoBackLine} onClick={() => save("project", p.id, { archived: 0 })}>
                        Restore
                      </Button>
                      <Button size="small" variant="ghost" leadingIcon={RiDeleteBinLine} onClick={() => gone(p.name, () => remove("project", p.id))}>
                        Delete
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {tasks.length > 0 && (
          <Card title="Tasks">
            <ul className="flex flex-col">
              {tasks.map((t) => {
                const edit = canEdit(projectOf(s, t.project_id));
                return (
                  <li key={t.id} className="flex items-center gap-3 border-b border-separator-border py-2.5 last:border-b-0">
                    <StatusIcon status={t.status} />
                    <span className="w-16 font-mono text-caption-1-medium text-text-tertiary">{taskKey(s, t)}</span>
                    <button onClick={() => navigate(withTask(t.id))} className="min-w-0 flex-1 truncate text-start text-body-medium text-text-primary hover:underline">
                      {t.title}
                    </button>
                    <span className="hidden text-caption-1-medium text-text-tertiary sm:block">{projectOf(s, t.project_id)?.name}</span>
                    {edit && (
                      <>
                        <Button size="small" variant="secondary" leadingIcon={RiArrowGoBackLine} onClick={() => save("task", t.id, { archived: 0 })}>
                          Restore
                        </Button>
                        <Button size="small" variant="ghost" leadingIcon={RiDeleteBinLine} onClick={() => gone(t.title, () => remove("task", t.id))}>
                          Delete
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
