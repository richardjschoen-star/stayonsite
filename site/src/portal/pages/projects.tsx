import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";
import { RiAddLine, RiArchiveLine, RiDeleteBinLine, RiFolderLine, RiLock2Line, RiSettings3Line, RiShareLine, RiStarFill, RiStarLine } from "@remixicon/react";
import { useState } from "react";
import { PSTAT } from "../constants";
import { Progress } from "../overlays/drawer";
import { openContextMenu, type MenuItem } from "../overlays/layer";
import { confirm, projectModal, shareModal } from "../overlays/modals";
import { Pick } from "../overlays/pickers";
import { navigate, to } from "../router";
import { archive, isAdmin, isFav, isLocked, personOf, progressOf, remove, save, tasksOf, toggleFavorite, toast, useSnap } from "../store";
import type { Project, Snapshot } from "../types";
import { AvatarStack, Empty, PageHeader, ProjectIcon, ProjectStatusChip, SearchField, fmtDay } from "../ui";

export function projectMenu(s: Snapshot, p: Project): MenuItem[] {
  const full = p.perm === "full";
  return [
    { label: "Open", icon: RiFolderLine, onSelect: () => navigate(to(s.org.slug, `projects/${p.id}`)) },
    { label: isFav(s, "project", p.id) ? "Unfavorite" : "Favorite", icon: RiStarLine, onSelect: () => toggleFavorite("project", p.id) },
    ...(full
      ? [
          { label: "Share…", icon: RiShareLine, onSelect: () => shareModal(p) },
          { label: "Settings…", icon: RiSettings3Line, onSelect: () => projectModal(p) },
          ...Object.entries(PSTAT).filter(([k]) => k !== p.status).map(([k, v], i) => ({ label: `Mark ${v.name.toLowerCase()}`, divider: i === 0, onSelect: () => save("project", p.id, { status: k as Project["status"] }) })),
          { label: "Archive", icon: RiArchiveLine, divider: true, onSelect: () => archive("project", p.id, p.name) },
          {
            label: "Delete",
            icon: RiDeleteBinLine,
            danger: true,
            onSelect: () =>
              confirm({ title: `Delete ${p.name}?`, body: "Every task, file, comment and sign-off in it is removed for everyone. This can't be undone.", action: "Delete project", danger: true }).then((ok) => {
                if (!ok) return;
                navigate(to(s.org.slug, "projects"), { replace: true });
                void remove("project", p.id).then(() => toast(`Deleted ${p.name}`));
              }),
          },
        ]
      : []),
  ];
}

export function Projects() {
  const s = useSnap();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"grid" | "list">(() => (localStorage.getItem("console:projects") as "grid" | "list") ?? "grid");
  const all = s.projects.filter((p) => isLocked(p) || !p.archived);
  const shown = all.filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!status || (!isLocked(p) && p.status === status)));
  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${all.length} project${all.length === 1 ? "" : "s"} in ${s.org.name}`}
        actions={
          isAdmin(s) && (
            <Button leadingIcon={RiAddLine} onClick={() => projectModal()}>
              New project
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={q} onChange={setQ} label="Search projects" />
          <Pick label="Status" options={[{ id: "", label: "Any status" }, ...Object.entries(PSTAT).map(([id, v]) => ({ id, label: v.name }))]} value={status} onChange={setStatus} className="h-8 border border-border-button-default px-2">
            <span className="text-body-medium text-text-primary">{status ? PSTAT[status as keyof typeof PSTAT].name : "Any status"}</span>
          </Pick>
          <span className="flex-1" />
          <SegmentedControl aria-label="Layout" selectedKeys={new Set([mode])} onSelectionChange={(k) => { const m = [...k][0] as "grid" | "list"; if (m) { setMode(m); localStorage.setItem("console:projects", m); } }}>
            <SegmentedControlItem id="grid">Grid</SegmentedControlItem>
            <SegmentedControlItem id="list">List</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </PageHeader>
      <div className="px-4 sm:px-8">
        {!shown.length ? (
          <Empty icon={RiFolderLine} title={all.length ? "No projects match" : "No projects yet"} body={!all.length && isAdmin(s) ? "Start one with the Engagement template to run the whole process here." : undefined} action={!all.length && isAdmin(s) ? <Button leadingIcon={RiAddLine} onClick={() => projectModal()}>New project</Button> : undefined} />
        ) : (
          <div className={cx(mode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col overflow-hidden rounded-3xl border border-border-button-default")}>
            {shown.map((p) =>
              isLocked(p) ? (
                <div key={p.id} className={cx("flex items-center gap-3 text-text-tertiary", mode === "grid" ? "rounded-3xl border border-dashed border-border-button-default p-5" : "border-b border-separator-border px-5 py-3")}>
                  <ProjectIcon p={p} />
                  <span className="min-w-0 flex-1 truncate text-body-medium">{p.name}</span>
                  <RiLock2Line className="size-4" aria-hidden />
                  <span className="text-caption-1-medium">Private</span>
                </div>
              ) : mode === "grid" ? (
                <ProjectCard key={p.id} p={p} s={s} />
              ) : (
                <button key={p.id} onClick={() => navigate(to(s.org.slug, `projects/${p.id}`))} onContextMenu={(e) => openContextMenu(e, projectMenu(s, p))} className="flex items-center gap-4 border-b border-separator-border px-5 py-3 text-start last:border-b-0 hover:bg-background-secondary-default">
                  <ProjectIcon p={p} />
                  <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{p.name}</span>
                  <ProjectStatusChip status={p.status} />
                  <Progress pct={progressOf(s, p.id)} className="hidden w-32 sm:block" />
                  <span className="hidden w-20 text-end text-body-2-medium text-text-secondary md:block">{p.due ? fmtDay(p.due) : "—"}</span>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ProjectCard({ p, s }: { p: Project; s: Snapshot }) {
  const pct = progressOf(s, p.id);
  const tasks = tasksOf(s, p.id);
  const fav = isFav(s, "project", p.id);
  const people = [...new Set([p.lead_id, ...Object.keys(p.members), ...tasks.map((t) => t.assignee_id)])].map((id) => personOf(s, id));
  const step = s.stages.filter((x) => x.project_id === p.id).find((x) => x.status === "active");
  return (
    <article onContextMenu={(e) => openContextMenu(e, projectMenu(s, p))} className="group relative flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 transition-shadow hover:shadow-dropdown dark:bg-background-secondary-default">
      <div className="flex items-start gap-3">
        <ProjectIcon p={p} size="lg" />
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate(to(s.org.slug, `projects/${p.id}`))} className="block w-full truncate text-start text-headline-medium text-text-primary after:absolute after:inset-0 after:content-['']">
            {p.name}
          </button>
          <p className="mt-0.5 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
            {p.key}
            {p.private && <RiLock2Line className="size-3" aria-label="Private" />}
          </p>
        </div>
        <button aria-label={fav ? "Unfavorite" : "Favorite"} aria-pressed={fav} onClick={() => toggleFavorite("project", p.id)} className={cx("relative z-10 rounded-lg p-1", fav ? "text-status-yellow-text" : "invisible text-foreground-icon-tertiary group-hover:visible")}>
          {fav ? <RiStarFill className="size-4" aria-hidden /> : <RiStarLine className="size-4" aria-hidden />}
        </button>
      </div>
      {step && (
        <p className="text-body-2-medium text-text-secondary">
          Step {step.n} of 11: <span className="text-text-primary">{step.name}</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <ProjectStatusChip status={p.status} />
          <span className="text-caption-1-medium text-text-tertiary tabular-nums">
            {tasks.filter((t) => t.status === "done").length}/{tasks.length} tasks · {pct}%
          </span>
        </div>
        <Progress pct={pct} />
      </div>
      <div className="flex items-center justify-between">
        <AvatarStack people={people} />
        <span className="text-body-2-medium text-text-secondary">{p.due ? `Due ${fmtDay(p.due)}` : "No due date"}</span>
      </div>
    </article>
  );
}
