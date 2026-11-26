import { Button } from "@/components/base/buttons/button";
import { Switch } from "@/components/base/switch/switch";
import { cx } from "@/utils/cx";
import { RiCheckDoubleLine, RiInboxLine, RiNotification3Line } from "@remixicon/react";
import { useState } from "react";
import { Thread } from "../overlays/drawer";
import { navigate, to } from "../router";
import { markRead, personOf, projectOf, readAll, taskOf, useSnap } from "../store";
import type { Notif, NotifType, Snapshot } from "../types";
import { Empty, PageHeader, PersonAvatar, ProjectIcon, timeAgo } from "../ui";

const CATS: [string, string, NotifType[]][] = [
  ["all", "All", ["mention", "assign", "comment", "approval", "invoice"]],
  ["mentions", "Mentions", ["mention"]],
  ["comments", "Comments", ["comment"]],
  ["assign", "Assignments", ["assign"]],
  ["signoff", "Sign-offs", ["approval"]],
  ["billing", "Billing", ["invoice"]],
];

const open = (s: Snapshot, n: Notif) => {
  if (!n.read) void markRead([n.id]);
  if (n.task_id && taskOf(s, n.task_id)) return navigate(to(s.org.slug, `projects/${n.project_id}`) + `?task=${n.task_id}`);
  if (n.stage_id) return navigate(to(s.org.slug, `projects/${n.project_id}/process`));
  if (n.type === "invoice") return navigate(to(s.org.slug, "settings/billing"));
  if (n.project_id) navigate(to(s.org.slug, `projects/${n.project_id}`));
};

function Line({ n, s, active, onClick }: { n: Notif; s: Snapshot; active?: boolean; onClick: () => void }) {
  const who = personOf(s, n.actor_id);
  const p = projectOf(s, n.project_id);
  return (
    <button onClick={onClick} className={cx("flex w-full items-start gap-3 border-b border-separator-border px-4 py-3 text-start", active ? "bg-background-secondary-hover" : "hover:bg-background-secondary-default")}>
      <span className="relative">
        <PersonAvatar person={who} size="md" />
        {!n.read && <span className="absolute -start-1 -top-0.5 size-2.5 rounded-full bg-accent-500 ring-2 ring-background-full" aria-label="Unread" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx("text-body-regular", n.read ? "text-text-secondary" : "text-text-primary")}>
          <span className="text-body-medium">{who?.name ?? "Someone"}</span> {n.text}
        </span>
        {n.snippet && <span className="truncate text-body-2-regular text-text-tertiary">“{n.snippet}”</span>}
        <span className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
          {p && <ProjectIcon p={p} size="sm" />}
          {p?.name}
          <span>·</span>
          {timeAgo(n.at)}
        </span>
      </span>
    </button>
  );
}

/** Mentions, comments, assignments and sign-offs, with a reading pane that lets you reply. */
export function Inbox() {
  const s = useSnap();
  const [cat, setCat] = useState("all");
  const [unread, setUnread] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const types = CATS.find((c) => c[0] === cat)![2];
  const list = s.notifs.filter((n) => types.includes(n.type) && (!unread || !n.read));
  const n = list.find((x) => x.id === sel) ?? null;
  const task = n ? taskOf(s, n.task_id) : null;
  const pick = (x: Notif) => {
    setSel(x.id);
    if (!x.read) void markRead([x.id]);
  };
  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Things that need you: mentions, replies, assignments and sign-offs."
        actions={
          <Button variant="secondary" leadingIcon={RiCheckDoubleLine} disabled={!s.notifs.some((x) => !x.read)} onClick={() => readAll()}>
            Mark all read
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-1">
          {CATS.map(([k, label, ts]) => {
            const c = s.notifs.filter((x) => ts.includes(x.type) && !x.read).length;
            return (
              <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k} className={cx("rounded-lg px-2.5 py-1.5 text-body-medium", cat === k ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:text-text-primary")}>
                {label}
                {c > 0 && <span className="ms-1.5 text-text-tertiary">{c}</span>}
              </button>
            );
          })}
          <span className="flex-1" />
          <Switch size="sm" isSelected={unread} onChange={setUnread}>
            Unread only
          </Switch>
        </div>
      </PageHeader>
      <div className="px-4 sm:px-8">
        <div className="grid min-h-[60vh] overflow-hidden rounded-3xl border border-border-button-default lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <div className="border-separator-border lg:border-e">
            {list.length ? list.map((x) => <Line key={x.id} n={x} s={s} active={x.id === sel} onClick={() => (matchMedia("(min-width: 1024px)").matches ? pick(x) : open(s, x))} />) : <Empty icon={RiInboxLine} title="Inbox zero" body="Nothing here. Mentions, replies and sign-off requests land here." />}
          </div>
          <div className="hidden min-w-0 flex-col lg:flex">
            {n ? (
              <div className="flex flex-col gap-5 overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-caption-1-semibold text-text-tertiary">{projectOf(s, n.project_id)?.name}</p>
                    <h2 className="mt-1 text-title-3-medium text-text-primary">{task?.title ?? s.stages.find((x) => x.id === n.stage_id)?.name ?? n.text}</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button size="small" variant="ghost" onClick={() => markRead([n.id], !n.read)}>
                      Mark {n.read ? "unread" : "read"}
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => open(s, n)}>
                      Open
                    </Button>
                  </div>
                </div>
                {n.project_id && (n.task_id || n.stage_id) && projectOf(s, n.project_id) ? (
                  <Thread projectId={n.project_id} taskId={task?.id} stageId={!task ? (n.stage_id ?? undefined) : undefined} internal={task?.internal} />
                ) : (
                  <p className="text-body-regular text-text-secondary">
                    {personOf(s, n.actor_id)?.name} {n.text}.
                  </p>
                )}
              </div>
            ) : (
              <Empty icon={RiInboxLine} title="Pick a message" body="Its conversation shows here, and you can reply without leaving the inbox." />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Every notification, updates included. */
export function Notifications() {
  const s = useSnap();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const list = s.notifs.filter((n) => filter === "all" || !n.read);
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <>
            <div className="flex gap-1">
              {(["all", "unread"] as const).map((k) => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={cx("rounded-lg px-2.5 py-1.5 text-body-medium capitalize", filter === k ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary")}>
                  {k}
                </button>
              ))}
            </div>
            <Button variant="secondary" leadingIcon={RiCheckDoubleLine} disabled={!s.notifs.some((n) => !n.read)} onClick={() => readAll()}>
              Mark all read
            </Button>
          </>
        }
      />
      <div className="px-4 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-border-button-default">
          {list.length ? list.map((n) => <Line key={n.id} n={n} s={s} onClick={() => open(s, n)} />) : <Empty icon={RiNotification3Line} title="You're all caught up" />}
        </div>
      </div>
    </>
  );
}

