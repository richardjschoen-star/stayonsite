import { useSyncExternalStore } from "react";
import { STATUSES } from "./constants";
import { ApiError, api, upload } from "./api";
import type {
  CalEvent, Comment, FileRow, Invoice, LockedProject, Me, OrgRef, Person, Project,
  SavedView, Snapshot, Stage, Task, Team,
} from "./types";

/**
 * One store, like gr8r's `S`: who I am, which workspaces I can open, and a
 * snapshot of the open one. Writes are optimistic (the UI changes at once,
 * then rolls back if the server says no) and every write is followed by a
 * cheap ETag'd refetch, which also picks up activity and notifications.
 */

export interface Toast {
  id: number;
  text: string;
  tone?: "error" | "success";
  action?: { label: string; run: () => void };
}

interface State {
  me: Me | null;
  orgs: OrgRef[];
  snap: Snapshot | null;
  /** True until /me answers. */
  booting: boolean;
  loadError: string | null;
  toasts: Toast[];
}

let state: State = { me: null, orgs: [], snap: null, booting: true, loadError: null, toasts: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export const useStore = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;
/** The open workspace's snapshot; only call under the shell, where it's loaded. */
export const useSnap = () => useStore().snap!;

/* ------------------------------------------------------------- toasts --- */

let toastId = 0;
export function toast(text: string, opts: Omit<Toast, "id" | "text"> = {}) {
  const id = ++toastId;
  set({ toasts: [...state.toasts, { id, text, ...opts }] });
  setTimeout(() => dismissToast(id), opts.action ? 6000 : 3500);
}
export const dismissToast = (id: number) => set({ toasts: state.toasts.filter((t) => t.id !== id) });

/* ------------------------------------------------------- loading + sync --- */

let etag: string | null = null;
let pending = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export async function boot() {
  try {
    const r = await api<{ user: Me; orgs: OrgRef[] }>("GET", "me");
    set({ me: r.user, orgs: r.orgs, booting: false });
  } catch (e) {
    set({ me: null, booting: false, loadError: e instanceof ApiError && e.status === 401 ? null : (e as Error).message });
  }
}

export async function reloadOrgs() {
  const r = await api<{ user: Me; orgs: OrgRef[] }>("GET", "me");
  set({ orgs: r.orgs, me: r.user });
}

export async function openOrg(orgId: string) {
  if (state.snap?.org.id !== orgId) {
    etag = null;
    set({ snap: null, loadError: null });
  }
  await refresh(orgId);
}

/** Fetch the snapshot unless it's unchanged (304). Skipped while writes are in flight. */
export async function refresh(orgId = state.snap?.org.id) {
  if (!orgId || pending) return;
  const res = await fetch(`/api/portal/snapshot?org=${orgId}`, { headers: etag ? { "if-none-match": etag } : {} }).catch(() => null);
  if (!res) return;
  if (res.status === 304) return;
  if (res.status === 401) return set({ me: null, snap: null });
  if (!res.ok) return set({ loadError: res.status === 404 ? "You don't have access to this workspace." : "The console couldn't load." });
  const snap = (await res.json()) as Snapshot;
  if (pending || (state.snap && state.snap.org.id !== orgId && state.snap.org.id !== snap.org.id)) return;
  etag = res.headers.get("etag");
  set({ snap, loadError: null });
}

/** Refetch even if the workspace version didn't move (e.g. after editing your own profile). */
export function forceRefresh() {
  etag = null;
  return refresh();
}

const soon = () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh(), 250);
};

// Keep fresh without realtime: on focus and every 30 s while visible.
// ponytail: polling, not push; add a Durable Object fan-out if people need live cursors.
window.addEventListener("focus", () => refresh());
setInterval(() => document.visibilityState === "visible" && refresh(), 30_000);

/* ------------------------------------------------------------ writing --- */

type Collections = {
  project: Project; task: Task; comment: Comment; stage: Stage; file: FileRow;
  event: CalEvent; invoice: Invoice; team: Team; view: SavedView;
};
export type Kind = keyof Collections;
const KEY = {
  project: "projects", task: "tasks", comment: "comments", stage: "stages", file: "files",
  event: "events", invoice: "invoices", team: "teams", view: "views",
} as const satisfies Record<Kind, keyof Snapshot>;

function upsert<K extends Kind>(s: Snapshot, kind: K, row: Partial<Collections[K]> & { id: string }): Snapshot {
  const list = s[KEY[kind]] as { id: string }[];
  const i = list.findIndex((r) => r.id === row.id);
  return { ...s, [KEY[kind]]: i < 0 ? [...list, row] : list.map((r, j) => (j === i ? { ...r, ...row } : r)) };
}
function drop(s: Snapshot, kind: Kind, id: string): Snapshot {
  return { ...s, [KEY[kind]]: (s[KEY[kind]] as { id: string }[]).filter((r) => r.id !== id) };
}

/**
 * Apply `optimistic` now, run `request`, fold its result in with `merge`.
 * On failure: put the old snapshot back and say why.
 */
export async function mutate<T>(
  optimistic: ((s: Snapshot) => Snapshot) | null,
  request: () => Promise<T>,
  merge?: (s: Snapshot, result: T) => Snapshot,
): Promise<T | undefined> {
  const before = state.snap;
  if (before && optimistic) set({ snap: optimistic(before) });
  pending++;
  try {
    const result = await request();
    if (merge && state.snap) set({ snap: merge(state.snap, result) });
    return result;
  } catch (e) {
    if (optimistic) set({ snap: before });
    toast((e as Error).message, { tone: "error" });
    return undefined;
  } finally {
    pending--;
    soon();
  }
}

const orgId = () => state.snap!.org.id;
export const newId = () => crypto.randomUUID();

/** PATCH one row. */
export const save = <K extends Kind>(kind: K, id: string, patch: Partial<Collections[K]>) =>
  mutate(
    (s) => upsert(s, kind, { id, ...patch }),
    () => api<Collections[K]>("PATCH", `${kind}/${id}`, patch),
    (s, r) => upsert(s, kind, r as Collections[K]),
  );

/** POST a new row; `fields.id` lets the UI show it before the server answers. */
export const create = <K extends Kind>(kind: K, fields: Partial<Collections[K]> & Record<string, unknown>, optimisticRow?: Partial<Collections[K]>) => {
  const id = (fields.id as string) ?? newId();
  return mutate(
    optimisticRow ? (s) => upsert(s, kind, { ...optimisticRow, id }) : null,
    () => api<Collections[K]>("POST", kind, { org_id: orgId(), ...fields, id }),
    (s, r) => upsert(s, kind, r as Collections[K]),
  );
};

export const remove = (kind: Kind, id: string) =>
  mutate((s) => drop(s, kind, id), () => api("DELETE", `${kind}/${id}`));

/* ------------------------------------------------------ domain actions --- */

export function createTask(fields: Partial<Task> & { project_id: string; title: string }) {
  const id = newId();
  const t = Date.now();
  const row: Task = {
    id, num: 0, status: "todo", priority: "none", assignee_id: null, start: null, due: null,
    labels: [], deps: [], subtasks: [], description: "", estimate: null, recur: null,
    ord: t, stage_id: null, internal: false, completed_at: null, archived: 0,
    created_by: state.me!.id, created_at: t, updated_at: t, ...fields,
  };
  return create("task", { ...fields, id }, row);
}

export const setTaskStatus = (t: Task, status: Task["status"]) => {
  const done = status === "done" && t.status !== "done";
  void save("task", t.id, { status, ...(done ? { completed_at: Date.now() } : {}) });
  if (done) toast(`Completed ${t.title}`, { tone: "success", action: { label: "Undo", run: () => save("task", t.id, { status: t.status }) } });
};

export function archive(kind: "task" | "project", id: string, name: string) {
  void save(kind, id, { archived: Date.now() });
  toast(`Archived ${name}`, { action: { label: "Undo", run: () => save(kind, id, { archived: 0 }) } });
}

export const comment = (fields: { project_id: string; task_id?: string | null; stage_id?: string | null; body: string; internal?: boolean }) => {
  const id = newId();
  return create("comment", { ...fields, id }, {
    id, author_id: state.me!.id, reactions: {}, created_at: Date.now(), edited_at: null,
    task_id: null, stage_id: null, internal: false, ...fields,
  });
};

export const react = (c: Comment, emoji: string) => {
  const me = state.me!.id;
  const list = c.reactions[emoji] ?? [];
  const reactions = { ...c.reactions, [emoji]: list.includes(me) ? list.filter((x) => x !== me) : [...list, me] };
  if (!reactions[emoji].length) delete reactions[emoji];
  return mutate(
    (s) => upsert(s, "comment", { id: c.id, reactions }),
    () => api<Comment>("PATCH", `comment/${c.id}`, { react: emoji }),
    (s, r) => upsert(s, "comment", r),
  );
};

export const toggleFavorite = (kind: "project" | "task", refId: string) =>
  mutate(
    (s) => {
      const on = s.favorites.some((f) => f.kind === kind && f.ref_id === refId);
      return { ...s, favorites: on ? s.favorites.filter((f) => !(f.kind === kind && f.ref_id === refId)) : [...s.favorites, { kind, ref_id: refId }] };
    },
    () => api("POST", "favorite", { kind, ref_id: refId }),
  );

export const markRead = (ids: string[], read = true) =>
  mutate(
    (s) => ({ ...s, notifs: s.notifs.map((n) => (ids.includes(n.id) ? { ...n, read } : n)) }),
    () => (ids.length === 1 ? api("PATCH", `notif/${ids[0]}`, { read }) : api("POST", "notif/read-all", { org_id: orgId(), ids })),
  );

export const readAll = () =>
  mutate((s) => ({ ...s, notifs: s.notifs.map((n) => ({ ...n, read: true })) }), () => api("POST", "notif/read-all", { org_id: orgId() }));

export async function uploadFiles(files: File[], where: { project?: string | null; task?: string | null; stage?: string | null; internal?: boolean }, onProgress?: (name: string, pct: number) => void) {
  pending++;
  try {
    for (const f of files) {
      const row = await upload<FileRow>(
        { org: orgId(), project: where.project, task: where.task, stage: where.stage, internal: where.internal ? "1" : null },
        f,
        (pct) => onProgress?.(f.name, pct),
      ).catch((e) => {
        toast(`${f.name}: ${e.message}`, { tone: "error" });
        return null;
      });
      if (row && state.snap) set({ snap: upsert(state.snap, "file", row) });
    }
  } finally {
    pending--;
    soon();
  }
}

export const stageAction = (s: Stage, action: "request" | "advance" | "decide", body: Record<string, unknown> = {}) =>
  mutate(null, () => api<Stage>("POST", `stage/${s.id}/${action}`, body), (snap, r) => (r && "id" in r ? upsert(snap, "stage", r) : snap));

export const invite = (email: string, role: string, name?: string, staff = false) =>
  mutate(null, () => api("POST", "invite", { org_id: staff ? null : orgId(), email, role, name }));

export const setMemberRole = (userId: string, role: string | null) =>
  mutate(
    (s) => ({ ...s, people: role ? s.people.map((p) => (p.id === userId ? { ...p, role: role as Person["role"] } : p)) : s.people.filter((p) => p.id !== userId) }),
    () => (role ? api("PATCH", `member/${orgId()}/${userId}`, { role }) : api("DELETE", `member/${orgId()}/${userId}`)),
  );

export const revokeInvite = (id: string) =>
  mutate((s) => ({ ...s, invites: s.invites.filter((i) => i.id !== id) }), () => api("DELETE", `invite/${id}`));

/* ---------------------------------------------------------- selectors --- */

export const isLocked = (p: Project | LockedProject): p is LockedProject => !!p.locked;
export const openProjects = (s: Snapshot) => s.projects.filter((p): p is Project => !isLocked(p) && !p.archived);
export const projectOf = (s: Snapshot, id: string | null | undefined) =>
  s.projects.find((p): p is Project => p.id === id && !isLocked(p));
export const personOf = (s: Snapshot, id: string | null | undefined) => s.people.find((p) => p.id === id);
export const taskOf = (s: Snapshot, id: string | null | undefined) => s.tasks.find((t) => t.id === id);
export const liveTasks = (s: Snapshot) => {
  const visible = new Set(openProjects(s).map((p) => p.id));
  return s.tasks.filter((t) => !t.archived && visible.has(t.project_id));
};
export const tasksOf = (s: Snapshot, projectId: string) => s.tasks.filter((t) => t.project_id === projectId && !t.archived);
export const taskKey = (s: Snapshot, t: Task) => `${projectOf(s, t.project_id)?.key ?? "?"}-${t.num || "…"}`;
export const isFav = (s: Snapshot, kind: "project" | "task", id: string) => s.favorites.some((f) => f.kind === kind && f.ref_id === id);

export const today = () => new Date().toLocaleDateString("en-CA");
export const isOver = (t: Task) => !!t.due && t.status !== "done" && t.due < today();

export function progressOf(s: Snapshot, projectId: string) {
  const ts = tasksOf(s, projectId);
  return ts.length ? Math.round((ts.filter((t) => t.status === "done").length / ts.length) * 100) : 0;
}
export function taskProgress(t: Task) {
  if (t.status === "done") return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter((x) => x.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] ?? 0;
}
export const statusName = (id: string) => STATUSES.find((s) => s.id === id)?.name ?? id;

export const canEdit = (p: Project | undefined) => !!p && (p.perm === "edit" || p.perm === "full");
export const canComment = (p: Project | undefined) => !!p && p.perm !== "view";
export const isAdmin = (s: Snapshot) => s.viewer.staff || s.viewer.role === "owner" || s.viewer.role === "admin";
