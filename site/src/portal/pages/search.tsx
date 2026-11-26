import { cx } from "@/utils/cx";
import { RiChat3Line, RiCompass3Line, RiSearchLine } from "@remixicon/react";
import { useState } from "react";
import { filePreview } from "../overlays/modals";
import { searchAll } from "../overlays/palette";
import { navigate, to, useRoute, withTask } from "../router";
import { personOf, projectOf, taskKey, useSnap } from "../store";
import { Card, Empty, FileIcon, Link, PageHeader, PersonAvatar, ProjectIcon, StatusIcon, timeAgo } from "../ui";
import { SearchField } from "../ui";

const CATS = ["all", "tasks", "projects", "people", "files", "comments"] as const;
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function Search() {
  const s = useSnap();
  const route = useRoute();
  const [q, setQ] = useState(route.query.get("q") ?? "");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const r = searchAll(s, q);
  const count = { all: r.tasks.length + r.projects.length + r.people.length + r.files.length + r.comments.length, tasks: r.tasks.length, projects: r.projects.length, people: r.people.length, files: r.files.length, comments: r.comments.length };
  const show = (c: (typeof CATS)[number]) => (cat === "all" || cat === c) && r[c as Exclude<typeof c, "all">].length > 0;
  return (
    <>
      <PageHeader title="Search">
        <SearchField value={q} onChange={(v) => (setQ(v), history.replaceState(null, "", `?q=${encodeURIComponent(v)}`))} label="Search the workspace" placeholder="Tasks, projects, people, files, comments…" autoFocus className="max-w-xl" />
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cx("rounded-lg px-2.5 py-1.5 text-body-medium capitalize", cat === c ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:text-text-primary")}>
              {c} {q && <span className="text-text-tertiary">{count[c]}</span>}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        {!q.trim() ? (
          <Empty icon={RiSearchLine} title="Search the whole workspace" body="Task titles and descriptions, project names, people, file names and comments." />
        ) : !count.all ? (
          <Empty icon={RiSearchLine} title={`Nothing matches “${q}”`} />
        ) : (
          <>
            {show("tasks") && (
              <Card title="Tasks">
                <ul className="flex flex-col">
                  {r.tasks.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => navigate(to(s.org.slug, `projects/${t.project_id}`) + `?task=${t.id}`)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-start hover:bg-background-secondary-default">
                        <StatusIcon status={t.status} />
                        <span className="w-16 font-mono text-caption-1-medium text-text-tertiary">{taskKey(s, t)}</span>
                        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{t.title}</span>
                        <span className="text-caption-1-medium text-text-tertiary">{projectOf(s, t.project_id)?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {show("projects") && (
              <Card title="Projects">
                <ul className="flex flex-col gap-1">
                  {r.projects.map((p) => (
                    <li key={p.id}>
                      <Link href={to(s.org.slug, `projects/${p.id}`)} className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-background-secondary-default">
                        <ProjectIcon p={p} />
                        <span className="text-body-medium text-text-primary">{p.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {show("people") && (
              <Card title="People">
                <ul className="flex flex-col gap-1">
                  {r.people.map((p) => (
                    <li key={p.id}>
                      <Link href={to(s.org.slug, `members/${p.id}`)} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-background-secondary-default">
                        <PersonAvatar person={p} size="sm" />
                        <span className="text-body-medium text-text-primary">{p.name}</span>
                        <span className="text-caption-1-medium text-text-tertiary">{p.email}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {show("files") && (
              <Card title="Files">
                <ul className="flex flex-col gap-1">
                  {r.files.map((f) => (
                    <li key={f.id}>
                      <button onClick={() => filePreview(f, s)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-start hover:bg-background-secondary-default">
                        <FileIcon type={f.type} name={f.name} />
                        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{f.name}</span>
                        <span className="text-caption-1-medium text-text-tertiary">{projectOf(s, f.project_id)?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {show("comments") && (
              <Card title="Comments">
                <ul className="flex flex-col gap-1">
                  {r.comments.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => (c.task_id ? navigate(withTask(c.task_id)) : navigate(to(s.org.slug, `projects/${c.project_id}/${c.stage_id ? "process" : "overview"}`)))} className="flex w-full items-start gap-3 rounded-lg px-1 py-1.5 text-start hover:bg-background-secondary-default">
                        <RiChat3Line className="mt-0.5 size-4 text-foreground-icon-tertiary" aria-hidden />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="line-clamp-2 text-body-regular text-text-primary">{plain(c.body)}</span>
                          <span className="text-caption-1-medium text-text-tertiary">
                            {personOf(s, c.author_id)?.name} · {timeAgo(c.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function NotFound() {
  const s = useSnap();
  return <Empty icon={RiCompass3Line} title="This page doesn't exist" body="The link may be old, or the page moved." action={<Link href={to(s.org.slug)} className="text-body-medium text-accent-500 underline">Go home</Link>} />;
}
