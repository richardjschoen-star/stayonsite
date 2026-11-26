import { OrdersChartCard } from "@/components/application/dashboard/orders-chart-card";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { RiAddLine, RiAlarmWarningLine, RiArrowRightLine, RiBillLine, RiCheckboxCircleLine, RiFolderLine, RiProgress4Line, RiQuillPenLine } from "@remixicon/react";
import { useState } from "react";
import { GATES } from "../../process";
import { ActivityList, Progress } from "../overlays/drawer";
import { newTask, projectModal } from "../overlays/modals";
import { Pick } from "../overlays/pickers";
import { navigate, to } from "../router";
import { isAdmin, isOver, liveTasks, openProjects, personOf, progressOf, projectOf, useSnap } from "../store";
import type { Snapshot } from "../types";
import { Card, Empty, Link, PageHeader, PersonAvatar, ProjectIcon, ProjectStatusChip, fmtDay, fmtMoney, relDay } from "../ui";
import { stageState } from "../views/process";
import { TaskList } from "../views/list";
import { FIELDS } from "../views/engine";
import { STATUSES } from "../constants";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/** Sign-offs and invoices someone has to act on, at the top of Home. */
function attention(s: Snapshot) {
  const out: { key: string; icon: typeof RiQuillPenLine; title: string; body: string; href: string; tone: "orange" | "rose" }[] = [];
  const clientAdmin = !s.viewer.staff && (s.viewer.role === "owner" || s.viewer.role === "admin");
  for (const st of s.stages) {
    const p = projectOf(s, st.project_id);
    if (!p || !st.gate) continue;
    const state = stageState(s, st);
    const g = GATES[st.gate];
    if (state === "waiting-client" && (clientAdmin || s.viewer.staff))
      out.push({ key: st.id, icon: RiQuillPenLine, tone: "orange", title: clientAdmin ? `${st.name} needs your ${g.label.toLowerCase()}` : `Waiting on ${s.org.name}: ${st.name}`, body: p.name, href: to(s.org.slug, `projects/${p.id}/process`) });
    if (state === "changes" && s.viewer.staff) out.push({ key: st.id, icon: RiAlarmWarningLine, tone: "rose", title: `Changes requested on ${st.name}`, body: st.decision_note ?? p.name, href: to(s.org.slug, `projects/${p.id}/process`) });
  }
  const today = new Date().toLocaleDateString("en-CA");
  for (const inv of s.invoices)
    if (inv.status === "sent")
      out.push({ key: inv.id, icon: RiBillLine, tone: inv.due && inv.due < today ? "rose" : "orange", title: `Invoice ${inv.number}: ${fmtMoney(inv.amount_cents, inv.currency)}`, body: inv.due ? `${inv.due < today ? "Overdue since" : "Due"} ${fmtDay(inv.due)}` : "Sent", href: to(s.org.slug, "settings/billing") });
  return out;
}

export function Home() {
  const s = useSnap();
  const me = personOf(s, s.viewer.id);
  const all = liveTasks(s);
  const mine = all.filter((t) => t.assignee_id === s.viewer.id);
  const active = openProjects(s).filter((p) => p.status !== "complete");
  const open = all.filter((t) => t.status !== "done");
  const doneWeek = all.filter((t) => t.status === "done" && t.completed_at && Date.now() - t.completed_at < 7 * 864e5);
  const overdue = all.filter(isOver);
  const [tab, setTab] = useState<"upcoming" | "overdue" | "completed">("upcoming");
  const lists = {
    upcoming: mine.filter((t) => t.status !== "done" && !isOver(t)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
    overdue: mine.filter(isOver),
    completed: mine.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0)).slice(0, 20),
  };
  const deadlines = open.filter((t) => t.due && !isOver(t)).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 6);
  const todo = attention(s);
  const stats: Stat[] = [
    { icon: RiFolderLine, label: "Active projects", value: String(active.length), delta: `${active.filter((p) => p.status === "risk").length} at risk`, deltaColor: active.some((p) => p.status === "risk") ? "rose" : "neutral", tone: "blue", caption: "in this workspace" },
    { icon: RiProgress4Line, label: "Open tasks", value: String(open.length), delta: `${open.filter((t) => t.assignee_id === s.viewer.id).length} yours`, deltaColor: "neutral", tone: "sky", caption: "assigned to you" },
    { icon: RiCheckboxCircleLine, label: "Completed", value: String(doneWeek.length), delta: "7 days", deltaColor: "lime", tone: "emerald", caption: "this week" },
    { icon: RiAlarmWarningLine, label: "Overdue", value: String(overdue.length), delta: overdue.length ? "late" : "on track", deltaColor: overdue.length ? "rose" : "lime", tone: "orange", caption: overdue.length ? "need attention" : "nothing late" },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me?.name.split(" ")[0] ?? "there"}`}
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        actions={
          <>
            <Button variant="secondary" leadingIcon={RiAddLine} onClick={() => newTask()}>
              New task
            </Button>
            {isAdmin(s) && (
              <Button leadingIcon={RiAddLine} onClick={() => projectModal()}>
                New project
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        {todo.length > 0 && (
          <Card title="Needs your attention">
            <ul className="flex flex-col gap-1.5">
              {todo.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-background-secondary-default">
                    <span className={cx("flex size-9 items-center justify-center rounded-xl", a.tone === "rose" ? "bg-status-rose-background text-status-rose-text" : "bg-status-orange-background text-status-orange-text")}>
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-medium text-text-primary">{a.title}</span>
                      <span className="truncate text-body-2-regular text-text-secondary">{a.body}</span>
                    </span>
                    <RiArrowRightLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <StatCards variant="footer" stats={stats} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card
            title="My tasks"
            padded={false}
            actions={
              <div role="tablist" className="flex gap-1">
                {(["upcoming", "overdue", "completed"] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("rounded-lg px-2 py-1 text-body-2-medium capitalize", tab === k ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:text-text-primary")}>
                    {k} <span className="text-text-tertiary">{lists[k].length}</span>
                  </button>
                ))}
              </div>
            }
          >
            <div className="pb-3">
              <TaskList tasks={lists[tab]} group="none" showProject collapseKey="home" empty={<Empty icon={RiCheckboxCircleLine} title={tab === "overdue" ? "Nothing overdue" : tab === "completed" ? "Nothing completed yet" : "You're all caught up"} body={tab === "upcoming" ? "Tasks assigned to you show up here." : undefined} />} />
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            <Card title="Upcoming deadlines">
              {deadlines.length ? (
                <ul className="flex flex-col">
                  {deadlines.map((t) => {
                    const p = projectOf(s, t.project_id);
                    return (
                      <li key={t.id}>
                        <Link href={`${location.pathname}?task=${t.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-background-secondary-default">
                          <span className="flex w-12 flex-col items-center rounded-lg bg-background-tertiary-default py-1">
                            <span className="text-caption-2-semibold text-text-tertiary uppercase">{new Date(`${t.due}T00:00`).toLocaleDateString("en-US", { month: "short" })}</span>
                            <span className="text-headline-semibold text-text-primary">{new Date(`${t.due}T00:00`).getDate()}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-body-medium text-text-primary">{t.title}</span>
                            <span className="truncate text-caption-1-medium text-text-tertiary">
                              {p?.name} · {relDay(t.due!)}
                            </span>
                          </span>
                          <PersonAvatar person={personOf(s, t.assignee_id)} size="sm" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-body-regular text-text-tertiary">No upcoming deadlines.</p>
              )}
            </Card>
            <Card title="Recent activity" actions={<Link href={to(s.org.slug, "activity")} className="text-body-2-medium text-text-secondary hover:text-text-primary">View all</Link>}>
              <ActivityList items={s.activity.slice(0, 8)} s={s} showProject />
            </Card>
          </div>
        </div>
        <Card title="Project progress" padded={false}>
          <ProjectTable s={s} />
        </Card>
      </div>
    </>
  );
}

function ProjectTable({ s }: { s: Snapshot }) {
  const projects = openProjects(s);
  if (!projects.length) return <Empty icon={RiFolderLine} title="No projects yet" />;
  return (
    <div className="overflow-x-auto pb-3">
      <table className="w-full min-w-[640px] text-start">
        <thead>
          <tr className="text-caption-1-semibold text-text-tertiary">
            {["Project", "Status", "Progress", "Lead", "Due"].map((h) => (
              <th key={h} className="px-5 py-2 text-start font-[inherit]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const pct = progressOf(s, p.id);
            return (
              <tr key={p.id} onClick={() => navigate(to(s.org.slug, `projects/${p.id}`))} className="cursor-pointer border-t border-separator-border hover:bg-background-secondary-default">
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2 text-body-medium text-text-primary">
                    <ProjectIcon p={p} />
                    {p.name}
                  </span>
                </td>
                <td className="px-5">
                  <ProjectStatusChip status={p.status} />
                </td>
                <td className="px-5">
                  <span className="flex items-center gap-2">
                    <Progress pct={pct} className="w-28" />
                    <span className="text-caption-1-medium text-text-tertiary tabular-nums">{pct}%</span>
                  </span>
                </td>
                <td className="px-5">
                  <PersonAvatar person={personOf(s, p.lead_id)} size="sm" />
                </td>
                <td className="px-5 text-body-2-medium text-text-secondary">{p.due ? fmtDay(p.due) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Workspace overview: portfolio, status mix, workload, milestones, throughput. */
export function Overview() {
  const s = useSnap();
  const all = liveTasks(s);
  const projects = openProjects(s);
  const open = all.filter((t) => t.status !== "done");
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = Date.now() - (11 - i) * 7 * 864e5;
    const start = end - 7 * 864e5;
    return {
      label: new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      current: all.filter((t) => t.completed_at && t.completed_at > start && t.completed_at <= end).length,
      previous: s.tasks.filter((t) => t.created_at > start && t.created_at <= end).length,
    };
  });
  const people = s.people.map((p) => ({ p, n: open.filter((t) => t.assignee_id === p.id).length, over: open.filter((t) => t.assignee_id === p.id && isOver(t)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const maxLoad = Math.max(1, ...people.map((x) => x.n));
  const milestones = projects.flatMap((p) => p.milestones.filter((m) => m.date && m.date >= new Date().toLocaleDateString("en-CA")).map((m) => ({ m, p }))).sort((a, b) => a.m.date!.localeCompare(b.m.date!)).slice(0, 8);
  const done = all.filter((t) => t.status === "done").length;
  const stats: Stat[] = [
    { icon: RiFolderLine, label: "Projects", value: String(projects.length), delta: `${projects.filter((p) => p.status === "complete").length} done`, deltaColor: "neutral", tone: "blue", caption: "in the portfolio" },
    { icon: RiProgress4Line, label: "Open tasks", value: String(open.length), delta: `${all.filter(isOver).length} overdue`, deltaColor: all.some(isOver) ? "rose" : "lime", tone: "sky", caption: "across projects" },
    { icon: RiCheckboxCircleLine, label: "Completion", value: `${all.length ? Math.round((done / all.length) * 100) : 0}%`, delta: `${done}/${all.length}`, deltaColor: "lime", tone: "emerald", caption: "of all tasks" },
    { icon: RiQuillPenLine, label: "Sign-offs", value: String(s.stages.filter((x) => x.decision === "approved").length), delta: `${s.stages.filter((x) => stageState(s, x) === "waiting-client").length} waiting`, deltaColor: "neutral", tone: "purple", caption: "given by the client" },
  ];

  return (
    <>
      <PageHeader title="Workspace overview" subtitle={`${s.org.name} at a glance.`} />
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        <StatCards variant="footer" stats={stats} />
        <div className="grid gap-5 xl:grid-cols-2">
          <OrdersChartCard title="Tasks completed" data={weeks} currentLabel="Completed" previousLabel="Created" comparisonLabel={["created that week", "created"]} className="flex-none" />
          <Card title="Tasks by status">
            <ul className="flex flex-col gap-3 pt-2">
              {STATUSES.map((st) => {
                const n = all.filter((t) => t.status === st.id).length;
                return (
                  <li key={st.id} className="flex items-center gap-3">
                    <span className="flex w-28 items-center gap-2 text-body-medium text-text-secondary">{FIELDS.status.options(s).find((o) => o.id === st.id)?.icon}{st.name}</span>
                    <Progress pct={all.length ? Math.round((n / all.length) * 100) : 0} className="flex-1" />
                    <span className="w-8 text-end text-body-2-medium text-text-tertiary tabular-nums">{n}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card title="Portfolio" padded={false}>
            <ProjectTable s={s} />
          </Card>
          <div className="flex flex-col gap-5">
            <Card title="Workload">
              {people.length ? (
                <ul className="flex flex-col gap-2.5">
                  {people.map(({ p, n, over }) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <PersonAvatar person={p} size="sm" />
                      <span className="w-28 truncate text-body-medium text-text-primary">{p.name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
                        <span className={cx("block h-full rounded-full", over ? "bg-status-orange-text" : "bg-accent-500")} style={{ width: `${(n / maxLoad) * 100}%` }} />
                      </span>
                      <span className="w-14 text-end text-caption-1-medium text-text-tertiary">
                        {n} open{over ? ` · ${over} late` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-regular text-text-tertiary">No one has open tasks.</p>
              )}
            </Card>
            <Card title="Upcoming milestones">
              {milestones.length ? (
                <ul className="flex flex-col gap-2">
                  {milestones.map(({ m, p }) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <ProjectIcon p={p} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{m.name}</span>
                      <span className="text-body-2-medium text-text-secondary">{relDay(m.date!)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-regular text-text-tertiary">No upcoming milestones. Add them on a project's overview.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

export function ActivityPage() {
  const s = useSnap();
  const [project, setProject] = useState("");
  const items = s.activity.filter((a) => !project || a.project_id === project);
  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Everything that happened in the workspace, newest first."
        actions={
          <Pick label="Project" options={[{ id: "", label: "All projects" }, ...openProjects(s).map((p) => ({ id: p.id, label: p.name, icon: <ProjectIcon p={p} size="sm" /> }))]} value={project} onChange={setProject} className="h-9 border border-border-button-default px-2.5">
            <span className="text-body-medium text-text-primary">{projectOf(s, project)?.name ?? "All projects"}</span>
          </Pick>
        }
      />
      <div className="px-4 sm:px-8">
        <Card>
          <ActivityList items={items} s={s} showProject />
        </Card>
      </div>
    </>
  );
}
