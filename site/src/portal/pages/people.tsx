import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { RiAddLine, RiCheckLine, RiCloseLine, RiMailLine, RiSubtractLine, RiTeamLine, RiUserAddLine } from "@remixicon/react";
import { useState } from "react";
import { ROLE_NAMES } from "../constants";
import { ActivityList } from "../overlays/drawer";
import { confirm, inviteModal, teamModal } from "../overlays/modals";
import { Pick } from "../overlays/pickers";
import { navigate, to, useRoute } from "../router";
import { isAdmin, liveTasks, openProjects, personOf, remove, revokeInvite, setMemberRole, useSnap } from "../store";
import type { Person, Role, Snapshot } from "../types";
import { Card, Empty, Link, PageHeader, PersonAvatar, ProjectIcon, SearchField, timeAgo, tint, ICONS } from "../ui";
import { TaskList } from "../views/list";

/** What each role can do, as enforced by worker/access.ts. */
const MATRIX: [string, boolean[]][] = [
  ["See shared projects", [true, true, true, true, false]],
  ["Comment and upload files", [true, true, true, true, true]],
  ["Create and edit tasks", [true, true, true, false, false]],
  ["Create projects", [true, true, true, false, false]],
  ["Invite people and manage roles", [true, true, true, false, false]],
  ["Sign off process steps", [false, true, true, false, false]],
  ["See invoices", [true, true, true, false, false]],
  ["Make owners, remove owners", [true, true, false, false, false]],
  ["See StayonSite's internal work", [true, false, false, false, false]],
  ["Run the engagement process", [true, false, false, false, false]],
];

function RoleCell({ s, p }: { s: Snapshot; p: Person }) {
  const me = s.viewer;
  const owners = s.people.filter((x) => x.role === "owner").length;
  if (p.staff) return <span className="text-body-2-medium text-text-secondary">StayonSite</span>;
  const canChange = (me.staff || me.role === "owner" || (me.role === "admin" && p.role !== "owner")) && !(p.role === "owner" && owners <= 1);
  const roles = (["owner", "admin", "member", "guest"] as Role[]).filter((r) => r !== "owner" || me.staff || me.role === "owner");
  return (
    <Pick
      label="Role"
      disabled={!canChange}
      options={[...roles.map((r) => ({ id: r, label: ROLE_NAMES[r] })), { id: "remove", label: `Remove from ${s.org.name}` }]}
      value={p.role}
      onChange={(r) =>
        r === "remove"
          ? confirm({ title: `Remove ${p.name}?`, body: `They lose access to ${s.org.name} right away.`, action: "Remove", danger: true }).then((ok) => ok && setMemberRole(p.id, null))
          : setMemberRole(p.id, r)
      }
    >
      <span className="text-body-2-medium text-text-primary">{ROLE_NAMES[p.role ?? "member"]}</span>
    </Pick>
  );
}

export function Members() {
  const s = useSnap();
  const route = useRoute();
  const [tab, setTab] = useState<"members" | "roles" | "teams">((route.query.get("tab") as "teams") ?? "members");
  const [q, setQ] = useState("");
  const client = s.people.filter((p) => !p.staff);
  const staff = s.people.filter((p) => p.staff);
  const match = (p: Person) => !q || `${p.name} ${p.email} ${p.title ?? ""}`.toLowerCase().includes(q.toLowerCase());
  const open = liveTasks(s).filter((t) => t.status !== "done");
  const row = (p: Person) => (
    <li key={p.id} className="flex items-center gap-3 border-b border-separator-border px-5 py-3 last:border-b-0">
      <PersonAvatar person={p} size="md" />
      <Link href={to(s.org.slug, `members/${p.id}`)} className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-medium text-text-primary hover:underline">
          {p.name}
          {p.id === s.viewer.id && <span className="text-text-tertiary"> (you)</span>}
        </span>
        <span className="truncate text-caption-1-medium text-text-tertiary">
          {p.email}
          {p.title ? ` · ${p.title}` : ""}
        </span>
      </Link>
      <span className="hidden w-24 text-end text-caption-1-medium text-text-tertiary sm:block">{open.filter((t) => t.assignee_id === p.id).length} open tasks</span>
      <span className="w-36 text-end">
        <RoleCell s={s} p={p} />
      </span>
    </li>
  );
  return (
    <>
      <PageHeader
        title="Members"
        subtitle={`${client.length} people at ${s.org.name}, with ${staff.length} from StayonSite.`}
        actions={
          isAdmin(s) && (
            <Button leadingIcon={RiUserAddLine} onClick={() => inviteModal()}>
              Invite people
            </Button>
          )
        }
      >
        <div className="flex items-center gap-1">
          {(
            [
              ["members", "Members"],
              ["roles", "Roles & permissions"],
              ["teams", "Teams"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={cx("rounded-lg px-2.5 py-1.5 text-body-medium", tab === k ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:text-text-primary")}>
              {label}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-col gap-5 px-4 sm:px-8">
        {tab === "members" && (
          <>
            <SearchField value={q} onChange={setQ} label="Search people" className="sm:w-64" />
            <Card title={s.org.name} padded={false}>
              <ul className="pb-2">{client.filter(match).map(row)}</ul>
              {!client.length && <Empty icon={RiTeamLine} title="No one from the client yet" body="Invite their team so they can follow the work and sign off steps." />}
            </Card>
            {s.invites.length > 0 && (
              <Card title="Pending invites" padded={false}>
                <ul className="pb-2">
                  {s.invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 border-b border-separator-border px-5 py-3 last:border-b-0">
                      <span className="flex size-8 items-center justify-center rounded-full bg-background-tertiary-default">
                        <RiMailLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-medium text-text-primary">{i.name ?? i.email}</span>
                        <span className="truncate text-caption-1-medium text-text-tertiary">
                          {i.email} · invited {timeAgo(i.created_at)} · expires {timeAgo(i.expires_at).replace(" ago", "")}
                        </span>
                      </span>
                      <span className="text-body-2-medium text-text-secondary">{ROLE_NAMES[i.role]}</span>
                      <Button size="small" variant="ghost" leadingIcon={RiCloseLine} onClick={() => revokeInvite(i.id)}>
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title="StayonSite team" padded={false}>
              <ul className="pb-2">{staff.filter(match).map(row)}</ul>
            </Card>
          </>
        )}
        {tab === "roles" && (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="text-caption-1-semibold text-text-tertiary">
                    <th className="px-5 py-3 text-start font-[inherit]">Permission</th>
                    {["StayonSite", "Owner", "Admin", "Member", "Guest"].map((r) => (
                      <th key={r} className="px-3 py-3 text-center font-[inherit]">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map(([what, can]) => (
                    <tr key={what} className="border-t border-separator-border">
                      <td className="px-5 py-2.5 text-body-regular text-text-primary">{what}</td>
                      {can.map((v, i) => (
                        <td key={i} className="text-center">
                          {v ? <RiCheckLine className="inline size-4 text-status-lime-text" aria-label="Allowed" /> : <RiSubtractLine className="inline size-4 text-foreground-icon-quaternary" aria-label="Not allowed" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 text-caption-1-medium text-text-tertiary">Guests only see projects they're added to. Per-project access (view, comment, edit, full) can raise anyone's permissions on that project; private projects are members-only.</p>
          </Card>
        )}
        {tab === "teams" && <TeamsGrid s={s} />}
      </div>
    </>
  );
}

function TeamsGrid({ s }: { s: Snapshot }) {
  if (!s.teams.length)
    return <Empty icon={RiTeamLine} title="No teams yet" body="Teams group people (yours and StayonSite's) around an area of work." action={isAdmin(s) && <Button leadingIcon={RiAddLine} onClick={() => teamModal()}>New team</Button>} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {s.teams.map((t) => {
        const Icon = ICONS[t.icon] ?? RiTeamLine;
        return (
          <Link key={t.id} href={to(s.org.slug, `teams/${t.id}`)} className="flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-5 hover:shadow-dropdown dark:bg-background-secondary-default">
            <span className="flex items-center gap-3">
              <span style={tint(t.color)} className="flex size-9 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--c)_16%,transparent)] text-[var(--c)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-headline-medium text-text-primary">{t.name}</span>
            </span>
            {t.description && <span className="text-body-regular text-text-secondary">{t.description}</span>}
            <span className="flex items-center gap-2 text-caption-1-medium text-text-tertiary">
              {t.members.length} members · {openProjects(s).filter((p) => p.team_id === t.id).length} projects
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function MemberPage() {
  const s = useSnap();
  const route = useRoute();
  const p = personOf(s, route.id);
  if (!p) return <Empty icon={RiTeamLine} title="Member not found" />;
  const tasks = liveTasks(s).filter((t) => t.assignee_id === p.id);
  const teams = s.teams.filter((t) => t.members.includes(p.id));
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 px-4 pt-6 pb-4 sm:px-8">
        <PersonAvatar person={p} size="lg" className="size-16 text-title-2-medium" />
        <div className="min-w-0 flex-1">
          <h1 className="text-title-2-medium text-text-primary">{p.name}</h1>
          <p className="text-body-regular text-text-secondary">
            {p.title ? `${p.title} · ` : ""}
            {p.staff ? "StayonSite" : ROLE_NAMES[p.role ?? "member"]}
            {p.tz ? ` · ${p.tz}` : ""}
          </p>
          <a href={`mailto:${p.email}`} className="text-body-2-medium text-text-tertiary hover:underline">
            {p.email}
          </a>
        </div>
        {!p.staff && (
          <span className="w-36">
            <RoleCell s={s} p={p} />
          </span>
        )}
      </div>
      <div className="grid gap-5 px-4 sm:px-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title={`Assigned tasks (${tasks.filter((t) => t.status !== "done").length} open)`} padded={false}>
          <div className="pb-3">
            <TaskList tasks={tasks} group="status" showProject collapseKey={`m:${p.id}`} empty={<Empty title="No tasks assigned" />} />
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="Teams">
            {teams.length ? (
              <ul className="flex flex-col gap-1">
                {teams.map((t) => (
                  <li key={t.id}>
                    <Link href={to(s.org.slug, `teams/${t.id}`)} className="text-body-medium text-text-primary hover:underline">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-regular text-text-tertiary">Not on a team.</p>
            )}
          </Card>
          <Card title="Projects">
            <ul className="flex flex-col gap-1.5">
              {openProjects(s)
                .filter((x) => x.lead_id === p.id || x.members[p.id] || tasks.some((t) => t.project_id === x.id))
                .map((x) => (
                  <li key={x.id}>
                    <Link href={to(s.org.slug, `projects/${x.id}`)} className="flex items-center gap-2 text-body-medium text-text-primary hover:underline">
                      <ProjectIcon p={x} size="sm" />
                      {x.name}
                      {x.lead_id === p.id && <span className="text-caption-1-medium text-text-tertiary">Lead</span>}
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
          <Card title="Recent activity">
            <ActivityList items={s.activity.filter((a) => a.actor_id === p.id).slice(0, 10)} s={s} showProject />
          </Card>
        </div>
      </div>
    </>
  );
}

export function TeamPage() {
  const s = useSnap();
  const route = useRoute();
  const t = s.teams.find((x) => x.id === route.id);
  if (!t) return <Empty icon={RiTeamLine} title="Team not found" />;
  const members = t.members.map((id) => personOf(s, id)).filter(Boolean) as Person[];
  const projects = openProjects(s).filter((p) => p.team_id === t.id);
  const tasks = liveTasks(s).filter((x) => x.assignee_id && t.members.includes(x.assignee_id) && x.status !== "done");
  const manage = isAdmin(s) || t.lead_id === s.viewer.id;
  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={t.description || `${members.length} members`}
        actions={
          manage && (
            <>
              <Button variant="secondary" onClick={() => teamModal(t)}>
                Edit team
              </Button>
              <Button variant="ghost" onClick={() => confirm({ title: `Delete ${t.name}?`, body: "Projects keep their work; they just lose the team label.", action: "Delete team", danger: true }).then((ok) => ok && (remove("team", t.id), navigate(to(s.org.slug, "members?tab=teams"), { replace: true })))}>
                Delete
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-5 px-4 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-5">
          <Card title="Members">
            <ul className="flex flex-col gap-2">
              {members.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <PersonAvatar person={p} size="md" />
                  <Link href={to(s.org.slug, `members/${p.id}`)} className="min-w-0 flex-1 truncate text-body-medium text-text-primary hover:underline">
                    {p.name}
                  </Link>
                  {t.lead_id === p.id && <span className="text-caption-1-medium text-text-tertiary">Lead</span>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Projects">
            {projects.length ? (
              <ul className="flex flex-col gap-1.5">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={to(s.org.slug, `projects/${p.id}`)} className="flex items-center gap-2 text-body-medium text-text-primary hover:underline">
                      <ProjectIcon p={p} size="sm" />
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-regular text-text-tertiary">No projects use this team yet.</p>
            )}
          </Card>
        </div>
        <Card title={`Open work (${tasks.length})`} padded={false}>
          <div className="pb-3">
            <TaskList tasks={tasks} group="assignee" showProject collapseKey={`t:${t.id}`} empty={<Empty title="Nothing open" />} />
          </div>
        </Card>
      </div>
    </>
  );
}
