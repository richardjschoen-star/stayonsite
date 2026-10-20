import { env } from "cloudflare:workers";
import {
  INVOICE_STATUS,
  LABELS,
  MAX_UPLOAD,
  PCOLORS,
  PERMS,
  PICONS,
  PRIOS,
  PSTAT,
  RECUR_DAYS,
  ROLES,
  STATUSES,
  TEMPLATES,
  VIEW_TYPES,
} from "../src/portal/constants";
import { ENGAGEMENT, GATES } from "../src/process";
import {
  atLeast,
  canDecide,
  canDeleteComment,
  canEditComment,
  canSetRole,
  isOrgAdmin,
  projectPerm,
  seesInvoice,
  seesRow,
  type Perm,
  type Role,
  type Viewer,
} from "./access";
import { auth } from "./auth";
import { link, send } from "./mail";

/**
 * The console API. Everything lives under /api/portal:
 *
 *   GET    me                      who am I, which orgs can I open
 *   GET    snapshot?org=           everything I may see in one org (ETag'd)
 *   POST   <entity>                create   ┐ project, task, comment, event,
 *   PATCH  <entity>/:id            update   │ invoice, team, view, stage (patch),
 *   DELETE <entity>/:id            delete   ┘ file (patch/delete), notif (patch)
 *   PUT    file?project=&task=…    upload (raw body)    GET file/:id  download
 *   POST   stage/:id/request|decide|advance   ask for, give, and move past sign-off
 *   POST   invite, favorite, notif/read-all, org        PATCH|DELETE member/:org/:user
 *
 * Every request resolves the org from the stored row (never from the body),
 * checks the caller against `access.ts`, writes activity and notifications in
 * the same batch, and bumps `org.version` so snapshots know to refresh.
 */

// D1 rows are untyped; every write goes through the validators below instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Stmt = D1PreparedStatement;

class Fail extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const fail = (status: number, message: string): never => {
  throw new Fail(status, message);
};
const notFound = () => fail(404, "Not found");
const bad = (message: string) => fail(400, message);

const q = (sql: string, ...args: unknown[]) =>
  env.DB.prepare(sql).bind(...args.map((a) => (a === undefined ? null : a)));
const first = <T = Row>(sql: string, ...args: unknown[]) => q(sql, ...args).first<T>();
const all = async <T = Row>(sql: string, ...args: unknown[]) =>
  (await q(sql, ...args).all<T>()).results;
const uid = () => crypto.randomUUID();
const now = () => Date.now();

const insert = (table: string, row: Row) => {
  const keys = Object.keys(row);
  return q(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    ...keys.map((k) => row[k]),
  );
};
const update = (table: string, id: string, patch: Row) => {
  const keys = Object.keys(patch);
  return q(
    `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
    ...keys.map((k) => patch[k]),
    id,
  );
};

/* ------------------------------------------------------------ output --- */

const JSON_COLS: Record<string, string[]> = {
  project: ["members", "milestones"],
  task: ["labels", "deps", "subtasks"],
  comment: ["reactions"],
  stage: ["items"],
  team: ["members"],
  saved_view: ["filters"],
  activity: ["data"],
};
const BOOL_COLS = ["private", "internal", "read"];

function out(table: string, row: Row): Row {
  const r = { ...row };
  for (const k of JSON_COLS[table] ?? []) if (typeof r[k] === "string") r[k] = JSON.parse(r[k]);
  for (const k of BOOL_COLS) if (k in r) r[k] = !!r[k];
  return r;
}

/* --------------------------------------------------------- org context --- */

interface Person {
  id: string;
  name: string;
  email: string;
  staff: boolean;
  role: Role | null;
}

interface Ctx {
  v: Viewer;
  org: Row;
  /** Org members plus every StayonSite staff user: the people work can involve. */
  people: Map<string, Person>;
  ip: string | null;
}

interface Me {
  id: string;
  name: string;
  email: string;
  staff: boolean;
}

async function orgCtx(me: Me, orgId: unknown, req: Request): Promise<Ctx> {
  if (typeof orgId !== "string" || !orgId) notFound();
  const [org, members, staff] = await env.DB.batch<Row>([
    q("SELECT * FROM org WHERE id = ?", orgId),
    q(
      `SELECT m.user_id AS id, u.name, u.email, m.role FROM member m JOIN "user" u ON u.id = m.user_id WHERE m.org_id = ?`,
      orgId,
    ),
    q(`SELECT id, name, email FROM "user" WHERE role = 'staff'`),
  ]);
  const o = org.results[0];
  if (!o) notFound();
  const people = new Map<string, Person>();
  for (const s of staff.results) people.set(s.id, { ...(s as Person), staff: true, role: null });
  for (const m of members.results)
    if (!people.has(m.id)) people.set(m.id, { ...(m as Person), staff: false });
  const v: Viewer = {
    id: me.id,
    staff: me.staff,
    role: me.staff ? null : (people.get(me.id)?.role ?? null),
  };
  if (!v.staff && !v.role) notFound();
  return { v, org: o, people, ip: req.headers.get("cf-connecting-ip") };
}

const viewerOf = (p: Person): Viewer => ({ id: p.id, staff: p.staff, role: p.role });
const nameOf = (c: Ctx, id: string | null) => (id ? (c.people.get(id)?.name ?? "someone") : "nobody");
const orgAdmins = (c: Ctx) =>
  [...c.people.values()].filter((p) => p.role === "owner" || p.role === "admin").map((p) => p.id);

/** Can this person see something in `project` (null = org-level)? */
function canSeeAs(c: Ctx, userId: string, project: Row | null, internal: boolean) {
  const p = c.people.get(userId);
  if (!p) return false;
  const v = viewerOf(p);
  if (internal && !v.staff) return false;
  return project ? !!projectPerm(v, project) : true;
}

const parseProject = (p: Row) => ({
  ...p,
  members: typeof p.members === "string" ? JSON.parse(p.members) : p.members,
});

/** The project and the viewer's permission on it; 404 if they can't see it. */
async function projectIn(c: Ctx, id: unknown) {
  if (typeof id !== "string") notFound();
  const row = await first("SELECT * FROM project WHERE id = ? AND org_id = ?", id, c.org.id);
  if (!row) notFound();
  const p = parseProject(row!);
  const perm = projectPerm(c.v, p);
  if (!perm) notFound();
  return { p, perm: perm as Perm };
}

/** Loads a row and its org/project context from the row itself. */
async function load(me: Me, table: string, id: string, req: Request) {
  const row = await first(`SELECT * FROM ${table} WHERE id = ?`, id);
  if (!row) notFound();
  let orgId = row!.org_id;
  if (!orgId && row!.project_id)
    orgId = (await first<{ org_id: string }>("SELECT org_id FROM project WHERE id = ?", row!.project_id))?.org_id;
  const c = await orgCtx(me, orgId, req);
  // A project row is its own project; everything else points at one (or none).
  const projectId = table === "project" ? row!.id : row!.project_id;
  const project = projectId ? await projectIn(c, projectId) : null;
  if (!seesRow(c.v, row!)) notFound();
  return { c, row: row!, p: project?.p ?? null, perm: project?.perm ?? null };
}

/* --------------------------------------------------------- validation --- */

type Check = (v: unknown, c: Ctx) => unknown;

const text =
  (max: number): Check =>
  (v) =>
    typeof v === "string" && v.trim() && v.length <= max ? v.trim() : bad(`Expected text up to ${max} characters`);
const optText =
  (max: number): Check =>
  (v, c) =>
    v == null || v === "" ? null : text(max)(v, c);
const oneOf =
  (xs: readonly string[], nullable = false): Check =>
  (v) =>
    nullable && (v == null || v === "") ? null : xs.includes(v as string) ? v : bad(`Expected one of ${xs.join(", ")}`);
const day: Check = (v) =>
  v == null || v === ""
    ? null
    : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? v
      : bad("Expected a YYYY-MM-DD date");
const time: Check = (v) =>
  v == null || v === "" ? null : typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : bad("Expected HH:MM");
const flag: Check = (v) => (v ? 1 : 0);
const stamp: Check = (v) => (v ? now() : 0);
const real: Check = (v) => (typeof v === "number" && Number.isFinite(v) ? v : bad("Expected a number"));
const cents: Check = (v) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1e13 ? v : bad("Expected an amount in cents");
const person: Check = (v, c) => (v == null || v === "" ? null : c.people.has(v as string) ? v : bad("Unknown person"));
const html =
  (max: number): Check =>
  (v) =>
    typeof v === "string" && v.length <= max ? sanitize(v) : bad("Text too long");

const list =
  <T>(max: number, item: (x: unknown, c: Ctx) => T): Check =>
  (v, c) => {
    if (!Array.isArray(v) || v.length > max) bad(`Expected a list of up to ${max}`);
    return JSON.stringify((v as unknown[]).map((x) => item(x, c)));
  };
const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Row) : bad("Expected an object"));
const ident = (x: unknown) => (typeof x === "string" && x.length <= 64 ? x : bad("Bad id"));
const short = (x: unknown) => text(300)(x, null as never) as string;

const labels = list(LABELS.length, (x) => oneOf(LABELS.map((l) => l.id))(x, null as never));
const checklist = (key: "title" | "text") =>
  list(100, (x) => {
    const o = obj(x);
    return { id: ident(o.id), [key]: short(o[key]), done: !!o.done };
  });
const milestones = list(50, (x) => {
  const o = obj(x);
  return { id: ident(o.id), name: short(o.name), date: day(o.date, null as never) };
});
const peopleList = list(200, (x, c) => person(x, c) ?? bad("Unknown person"));
const filters = list(20, (x) => {
  const o = obj(x);
  return { f: text(40)(o.f, null as never), op: text(20)(o.op, null as never), v: Array.isArray(o.v) ? o.v.slice(0, 50).map(String) : [] };
});
const projectMembers: Check = (v, c) => {
  const o = obj(v);
  const res: Record<string, Perm> = {};
  for (const [k, p] of Object.entries(o)) {
    if (!c.people.has(k)) bad("Unknown person");
    res[k] = oneOf(PERMS.map((x) => x.id))(p, c) as Perm;
  }
  return JSON.stringify(res);
};

async function pick(body: Row, schema: Record<string, Check>, c: Ctx) {
  const res: Row = {};
  for (const [k, check] of Object.entries(schema)) if (k in body) res[k] = await check(body[k], c);
  return res;
}

/** Keeps descriptions and comments to plain formatting: no scripts, no styles, safe links. */
const ALLOWED = new Set(["p", "br", "b", "strong", "i", "em", "u", "s", "code", "pre", "ul", "ol", "li", "blockquote", "a", "span", "h1", "h2", "h3", "div"]);
const DROP = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "form", "input", "button", "textarea", "select", "link", "meta", "base", "img", "video", "audio", "noscript", "frame", "frameset", "title", "head"]);
function sanitize(input: string): Promise<string> {
  return new HTMLRewriter()
    .on("*", {
      element(el) {
        const tag = el.tagName.toLowerCase();
        if (DROP.has(tag)) return void el.remove();
        if (!ALLOWED.has(tag)) return void el.removeAndKeepContent();
        for (const [name, value] of [...el.attributes]) {
          const keep =
            (tag === "a" && name === "href" && /^(https?:|mailto:)/i.test(value.trim())) ||
            (tag === "span" && name === "data-mention");
          if (!keep) el.removeAttribute(name);
        }
        if (tag === "a") el.setAttribute("rel", "noopener noreferrer nofollow").setAttribute("target", "_blank");
      },
      comments(cm) {
        cm.remove();
      },
    })
    .transform(new Response(input, { headers: { "content-type": "text/html" } }))
    .text();
}

const mentions = (html: string) => [...html.matchAll(/data-mention="([^"]+)"/g)].map((m) => m[1]);
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const snippet = (html: string) => plain(html).slice(0, 140);
const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------ activity + notifying --- */

interface Ref {
  project_id?: string | null;
  task_id?: string | null;
  stage_id?: string | null;
  internal?: boolean | number;
}

const act = (c: Ctx, verb: string, ref: Ref, extra = "") =>
  insert("activity", {
    id: uid(),
    org_id: c.org.id,
    project_id: ref.project_id ?? null,
    task_id: ref.task_id ?? null,
    stage_id: ref.stage_id ?? null,
    actor_id: c.v.id,
    verb,
    data: JSON.stringify({ extra }),
    internal: ref.internal ? 1 : 0,
    at: now(),
  });

interface Note extends Ref {
  type: "mention" | "assign" | "comment" | "update" | "approval" | "invoice";
  text: string;
  snippet?: string;
  project?: Row | null;
}

/** One notification per recipient who can see the thing, never to the actor. */
function notify(c: Ctx, to: Iterable<string | null | undefined>, n: Note) {
  const seen = new Set<string>();
  const stmts: Stmt[] = [];
  for (const id of to) {
    if (!id || id === c.v.id || seen.has(id)) continue;
    seen.add(id);
    if (!canSeeAs(c, id, n.project ?? null, !!n.internal)) continue;
    stmts.push(
      insert("notif", {
        id: uid(),
        user_id: id,
        org_id: c.org.id,
        type: n.type,
        actor_id: c.v.id,
        project_id: n.project?.id ?? n.project_id ?? null,
        task_id: n.task_id ?? null,
        stage_id: n.stage_id ?? null,
        text: n.text,
        snippet: n.snippet ?? "",
        read: 0,
        at: now(),
      }),
    );
  }
  return { stmts, to: [...seen].filter((id) => canSeeAs(c, id, n.project ?? null, !!n.internal)) };
}

function mail(c: Ctx, ids: string[], subject: string, body: string) {
  for (const id of ids) {
    const p = c.people.get(id);
    if (p && id !== c.v.id) send(p.email, subject, body);
  }
}

async function commit(c: Ctx, stmts: Stmt[]) {
  stmts.push(q("UPDATE org SET version = version + 1 WHERE id = ?", c.org.id));
  try {
    return await env.DB.batch(stmts);
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes("UNIQUE")) fail(409, "That already exists");
    if (msg.includes("FOREIGN KEY")) bad("Something it points to doesn't exist");
    throw e;
  }
}

const reread = async (table: string, id: string) => out(table, (await first(`SELECT * FROM ${table} WHERE id = ?`, id))!);

/* ------------------------------------------------------------- reads --- */

async function me(user: Me) {
  const orgs = user.staff
    ? await all("SELECT id, name, slug, color, NULL AS role FROM org ORDER BY name")
    : await all(
        "SELECT o.id, o.name, o.slug, o.color, m.role FROM member m JOIN org o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name",
        user.id,
      );
  return { orgs };
}

async function snapshot(c: Ctx, req: Request) {
  const tag = `"${c.org.version}:${c.v.id}:${c.v.role ?? (c.v.staff ? "staff" : "")}"`;
  if (req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers: { etag: tag } });

  const o = c.org.id;
  const [projects, stages, tasks, comments, files, events, invoices, activity, notifs, teams, views, favorites, members, invites] =
    await env.DB.batch<Row>([
      q("SELECT * FROM project WHERE org_id = ? ORDER BY ord, created_at", o),
      q("SELECT s.* FROM stage s JOIN project p ON p.id = s.project_id WHERE p.org_id = ? ORDER BY s.n", o),
      q("SELECT t.* FROM task t JOIN project p ON p.id = t.project_id WHERE p.org_id = ? ORDER BY t.ord", o),
      q("SELECT c.* FROM comment c JOIN project p ON p.id = c.project_id WHERE p.org_id = ? ORDER BY c.created_at", o),
      q("SELECT * FROM file WHERE org_id = ? ORDER BY created_at DESC", o),
      q("SELECT * FROM event WHERE org_id = ? ORDER BY date, time", o),
      q("SELECT * FROM invoice WHERE org_id = ? ORDER BY issued DESC, created_at DESC", o),
      q("SELECT * FROM activity WHERE org_id = ? ORDER BY at DESC LIMIT 500", o),
      q("SELECT * FROM notif WHERE org_id = ? AND user_id = ? ORDER BY at DESC LIMIT 200", o, c.v.id),
      q("SELECT * FROM team WHERE org_id = ? ORDER BY name", o),
      q("SELECT * FROM saved_view WHERE org_id = ? AND (user_id IS NULL OR user_id = ?) ORDER BY created_at", o, c.v.id),
      q("SELECT kind, ref_id FROM favorite WHERE org_id = ? AND user_id = ?", o, c.v.id),
      q(
        `SELECT u.id, u.name, u.email, u.image, u.title, u.tz, u.role AS kind, m.role, m.created_at AS joined
         FROM "user" u LEFT JOIN member m ON m.user_id = u.id AND m.org_id = ?
         WHERE m.org_id IS NOT NULL OR u.role = 'staff' ORDER BY u.name`,
        o,
      ),
      q("SELECT id, email, name, role, created_at, expires_at FROM invite WHERE org_id = ? AND expires_at > ?", o, now()),
    ]);

  // Projects: visible ones in full; private ones you're not on as locked stubs (gr8r shows them as locked cards).
  const perms = new Map<string, Perm>();
  const visibleProjects: Row[] = [];
  for (const raw of projects.results) {
    const p = parseProject(raw);
    const perm = projectPerm(c.v, p);
    if (perm) {
      perms.set(p.id, perm);
      visibleProjects.push({ ...out("project", raw), perm });
    } else if (c.v.role !== "guest" && p.private)
      visibleProjects.push({ id: p.id, key: p.key, name: p.name, icon: p.icon, color: p.color, private: true, locked: true });
  }
  const sees = (r: Row) => (!r.project_id || perms.has(r.project_id)) && seesRow(c.v, r);
  const visibleTasks = tasks.results.filter(sees);
  const taskIds = new Set(visibleTasks.map((t) => t.id));
  const onVisibleTask = (r: Row) => !r.task_id || taskIds.has(r.task_id);
  const admin = isOrgAdmin(c.v);

  const body = {
    org: { id: c.org.id, name: c.org.name, slug: c.org.slug, color: c.org.color },
    viewer: c.v,
    people: members.results.map((u) => ({ ...u, staff: u.kind === "staff", kind: undefined })),
    invites: admin ? invites.results : [],
    teams: teams.results.map((r) => out("team", r)),
    projects: visibleProjects,
    stages: stages.results.filter(sees).map((r) => out("stage", r)),
    tasks: visibleTasks.map((r) => out("task", r)),
    comments: comments.results.filter((r) => sees(r) && onVisibleTask(r)).map((r) => out("comment", r)),
    // Org-level files (no project) back invoices, so they follow invoice visibility.
    files: files.results
      .filter((r) => sees(r) && onVisibleTask(r) && (r.project_id || admin))
      .map((r) => out("file", r)),
    events: events.results.filter(sees),
    invoices: invoices.results.filter((r) => seesInvoice(c.v, r)),
    activity: activity.results.filter((r) => sees(r) && onVisibleTask(r)).map((r) => out("activity", r)),
    notifs: notifs.results.map((r) => out("notif", r)),
    views: views.results.filter((r) => !r.project_id || perms.has(r.project_id)).map((r) => out("saved_view", r)),
    favorites: favorites.results,
  };
  return Response.json(body, { headers: { etag: tag, "cache-control": "private, no-cache" } });
}

/* ------------------------------------------------------------ orgs --- */

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";

async function createOrg(me: Me, body: Row) {
  if (!me.staff) fail(403, "Only StayonSite can add clients");
  const name = text(80)(body.name, null as never) as string;
  const row = {
    id: uid(),
    name,
    slug: slugify(typeof body.slug === "string" && body.slug ? body.slug : name),
    color: oneOf(Object.keys(PCOLORS))(body.color ?? "indigo", null as never),
    version: 0,
    created_at: now(),
  };
  try {
    await insert("org", row).run();
  } catch {
    fail(409, "A client with that URL already exists");
  }
  return row;
}

async function patchOrg(me: Me, id: string, body: Row, req: Request) {
  const c = await orgCtx(me, id, req);
  if (!c.v.staff && c.v.role !== "owner") fail(403, "Only owners rename the workspace");
  const patch = await pick(body, { name: text(80), color: oneOf(Object.keys(PCOLORS)) }, c);
  if (Object.keys(patch).length) await commit(c, [update("org", id, patch)]);
  return first("SELECT id, name, slug, color FROM org WHERE id = ?", id);
}

async function deleteOrg(me: Me, id: string, req: Request) {
  const c = await orgCtx(me, id, req);
  if (!c.v.staff) fail(403, "Only StayonSite can remove a client");
  // R2 first: once the rows are gone nothing points at the objects.
  let cursor: string | undefined;
  do {
    const page = await env.FILES.list({ prefix: `${id}/`, cursor });
    if (page.objects.length) await env.FILES.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await q("DELETE FROM org WHERE id = ?", id).run();
  return { ok: true };
}

/* ------------------------------------------------------ people + invites --- */

async function invite(me: Me, body: Row, req: Request) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) bad("Enter a valid email");
  const name = optText(80)(body.name, null as never) as string | null;

  // Staff invites live outside any org.
  if (body.org_id == null) {
    if (!me.staff) fail(403, "Only StayonSite can add staff");
    const existing = await first<{ id: string }>('SELECT id FROM "user" WHERE email = ?', email);
    if (existing) await q(`UPDATE "user" SET role = 'staff' WHERE id = ?`, existing.id).run();
    else
      await q(
        `INSERT INTO invite (id, email, name, org_id, role, invited_by, created_at, expires_at) VALUES (?, ?, ?, NULL, 'staff', ?, ?, ?)
         ON CONFLICT DO UPDATE SET expires_at = excluded.expires_at, invited_by = excluded.invited_by`,
        uid(), email, name, me.id, now(), now() + 14 * 864e5,
      ).run();
    send(email, `${me.name} added you to the StayonSite team`, `Sign in to the console with this email:\n\n${link("/login")}`);
    return { ok: true };
  }

  const c = await orgCtx(me, body.org_id, req);
  const role = oneOf(ROLES)(body.role ?? "member", c) as Role;
  const owners = orgAdmins(c).filter((id) => c.people.get(id)?.role === "owner").length;
  if (!canSetRole(c.v, null, role, owners)) fail(403, "You can't invite with that role");

  const existing = await first<{ id: string; role: string }>('SELECT id, role FROM "user" WHERE email = ?', email);
  if (existing?.role === "staff") bad("That's a StayonSite account; it already sees every client");
  if (existing) {
    if (c.people.has(existing.id)) bad("Already a member");
    await commit(c, [
      insert("member", { org_id: c.org.id, user_id: existing.id, role, created_at: now() }),
      act(c, "added", {}, `${email} as ${role}`),
    ]);
    send(email, `You now have access to ${c.org.name} on StayonSite`, `${me.name} added you.\n\n${link(`/${c.org.slug}`)}`);
  } else {
    await commit(c, [
      q(
        `INSERT INTO invite (id, email, name, org_id, role, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET role = excluded.role, name = excluded.name, invited_by = excluded.invited_by, expires_at = excluded.expires_at`,
        uid(), email, name, c.org.id, role, me.id, now(), now() + 14 * 864e5,
      ),
      act(c, "invited", {}, email),
    ]);
    send(
      email,
      `${me.name} invited you to ${c.org.name} on StayonSite`,
      `You've been invited to the ${c.org.name} workspace in the StayonSite console, where you can follow the project, review work and sign off each stage.\n\nSign in with this email address:\n${link("/login")}\n\nThe invite expires in 14 days.`,
    );
  }
  return { ok: true };
}

async function revokeInvite(me: Me, id: string, req: Request) {
  const row = await first("SELECT * FROM invite WHERE id = ?", id);
  if (!row) notFound();
  if (row!.org_id == null) {
    if (!me.staff) notFound();
    await q("DELETE FROM invite WHERE id = ?", id).run();
    return { ok: true };
  }
  const c = await orgCtx(me, row!.org_id, req);
  if (!isOrgAdmin(c.v)) fail(403, "Only admins manage invites");
  await commit(c, [q("DELETE FROM invite WHERE id = ?", id)]);
  return { ok: true };
}

async function setMember(me: Me, orgId: string, userId: string, body: Row | null, req: Request) {
  const c = await orgCtx(me, orgId, req);
  const target = c.people.get(userId);
  if (!target || target.staff) notFound();
  const next = body ? (oneOf(ROLES)(body.role, c) as Role) : null;
  const owners = [...c.people.values()].filter((p) => p.role === "owner").length;
  // Anyone may leave, unless they're the last owner.
  const leaving = !body && userId === c.v.id && !(target!.role === "owner" && owners <= 1);
  if (!leaving && !canSetRole(c.v, target!.role, next, owners)) fail(403, "You can't make that change");
  await commit(c, [
    next
      ? q("UPDATE member SET role = ? WHERE org_id = ? AND user_id = ?", next, orgId, userId)
      : q("DELETE FROM member WHERE org_id = ? AND user_id = ?", orgId, userId),
    act(c, next ? "changed the role of" : "removed", {}, next ? `${target!.name} to ${next}` : target!.name),
  ]);
  return { ok: true };
}

/* ---------------------------------------------------------- projects --- */

const PROJECT: Record<string, Check> = {
  name: text(80),
  icon: oneOf(PICONS),
  color: oneOf(Object.keys(PCOLORS)),
  status: oneOf(Object.keys(PSTAT)),
  lead_id: person,
  start: day,
  due: day,
  description: html(20000),
  members: projectMembers,
  milestones,
  private: flag,
  archived: stamp,
  ord: real,
  team_id: async (v, c) => {
    if (v == null || v === "") return null;
    return (await first("SELECT 1 FROM team WHERE id = ? AND org_id = ?", v, c.org.id)) ? v : bad("Unknown team");
  },
};

const makeKey = (name: string) =>
  (name.match(/\b[A-Za-z0-9]/g)?.join("") ?? "").slice(0, 3).toUpperCase().padEnd(2, "X") || "PRJ";

async function createProject(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  if (!isOrgAdmin(c.v)) fail(403, "Only admins create projects");
  const f = await pick(body, PROJECT, c);
  if (!f.name) bad("Give the project a name");
  const template = TEMPLATES.find((t) => t.id === (body.template ?? "blank")) ?? bad("Unknown template");
  if (template!.id === "engagement" && !c.v.staff) fail(403, "Only StayonSite starts engagements");

  const id = typeof body.id === "string" ? id_(body.id) : uid();
  const key = typeof body.key === "string" && /^[A-Z0-9]{2,6}$/.test(body.key) ? body.key : makeKey(f.name);
  const t = now();
  const members = f.members ? JSON.parse(f.members) : {};
  // Whoever creates a project runs it (staff already have full access everywhere).
  if (!c.v.staff || f.private) members[c.v.id] = "full";
  const row = {
    status: "planning",
    start: today(),
    lead_id: c.v.id,
    ...f,
    id,
    org_id: c.org.id,
    key,
    members: JSON.stringify(members),
    template: template!.id,
    created_by: c.v.id,
    created_at: t,
    updated_at: t,
    ord: f.ord ?? -t,
  };
  const stmts: Stmt[] = [insert("project", row), act(c, "created project", { project_id: id })];

  if (template!.id === "engagement")
    for (const s of ENGAGEMENT)
      stmts.push(
        insert("stage", {
          id: uid(),
          project_id: id,
          n: s.n,
          phase: s.phase,
          name: s.name,
          length: s.length,
          owner_id: row.lead_id,
          status: s.n === 1 ? "active" : "todo",
          gate: s.gate,
          items: JSON.stringify(s.items.map((text) => ({ id: uid(), text, done: false }))),
        }),
      );
  template!.tasks.forEach((title, i) =>
    stmts.push(
      insertTask(c, {
        id: uid(),
        project_id: id,
        title,
        status: i === 0 ? "todo" : "backlog",
        priority: i === 0 ? "high" : "medium",
        assignee_id: i === 0 ? c.v.id : null,
        start: addDays(today(), i * 5),
        due: addDays(today(), 5 + i * 5),
        ord: i,
      }),
    ),
  );
  await commit(c, stmts);
  return reread("project", id);
}

const id_ = (v: string) => (/^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : bad("Bad id"));

async function patchProject(me: Me, id: string, body: Row, req: Request) {
  const { c, row, perm } = await load(me, "project", id, req);
  // Reordering the sidebar is personal enough that editors may do it; the rest needs full access.
  const onlyOrd = Object.keys(body).every((k) => k === "ord");
  if (!atLeast(perm, onlyOrd ? "edit" : "full")) fail(403, "You can't change this project");
  const f = await pick(body, PROJECT, c);
  if (!Object.keys(f).length) return out("project", row);
  const stmts: Stmt[] = [update("project", id, { ...f, updated_at: now() })];
  const ref = { project_id: id };
  if (f.status && f.status !== row.status)
    stmts.push(act(c, "changed status of", ref, `to ${PSTAT[f.status as keyof typeof PSTAT].name}`));
  if ("archived" in f && !!f.archived !== !!row.archived) stmts.push(act(c, f.archived ? "archived" : "restored", ref));
  if (f.name && f.name !== row.name) stmts.push(act(c, "renamed project", ref, `to “${f.name}”`));
  if (f.members && f.members !== row.members) stmts.push(act(c, "updated sharing of", ref));
  await commit(c, stmts);
  return reread("project", id);
}

async function deleteProject(me: Me, id: string, req: Request) {
  const { c, perm } = await load(me, "project", id, req);
  if (perm !== "full") fail(403, "You can't delete this project");
  await deleteObjects(await all<{ id: string }>("SELECT id FROM file WHERE project_id = ?", id), c.org.id);
  await commit(c, [q("DELETE FROM project WHERE id = ?", id), act(c, "deleted a project", {})]);
  return { ok: true };
}

/* ------------------------------------------------------------- tasks --- */

const TASK: Record<string, Check> = {
  title: text(300),
  status: oneOf(STATUSES.map((s) => s.id)),
  priority: oneOf(PRIOS.map((p) => p.id)),
  assignee_id: person,
  start: day,
  due: day,
  labels,
  subtasks: checklist("title"),
  description: html(50000),
  estimate: optText(20),
  recur: oneOf(Object.keys(RECUR_DAYS), true),
  ord: real,
  archived: stamp,
  deps: list(50, ident),
};

/** Insert with the next per-project number (WEB-1, WEB-2…), assigned atomically. */
function insertTask(c: Ctx, f: Row) {
  const t = now();
  const row: Row = {
    status: "todo",
    priority: "none",
    ...f,
    completed_at: f.status === "done" ? t : null,
    created_by: c.v.id,
    created_at: t,
    updated_at: t,
  };
  const keys = Object.keys(row);
  return q(
    `INSERT INTO task (${keys.join(", ")}, num) VALUES (${keys.map(() => "?").join(", ")},
     (SELECT COALESCE(MAX(num), 0) + 1 FROM task WHERE project_id = ?))`,
    ...keys.map((k) => row[k]),
    row.project_id,
  );
}

/** Dependencies and stage links must stay inside the same org / project. */
async function checkTaskRefs(c: Ctx, f: Row, projectId: string) {
  if (f.deps) {
    const deps: string[] = JSON.parse(f.deps);
    if (deps.length) {
      const n = await first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM task t JOIN project p ON p.id = t.project_id WHERE p.org_id = ? AND t.id IN (${deps.map(() => "?").join(",")})`,
        c.org.id,
        ...deps,
      );
      if (n?.n !== new Set(deps).size) bad("Unknown dependency");
    }
  }
  if (f.stage_id && !(await first("SELECT 1 FROM stage WHERE id = ? AND project_id = ?", f.stage_id, projectId)))
    bad("Unknown stage");
}

async function createTask(me: Me, body: Row, req: Request) {
  const pid = await first<{ org_id: string }>("SELECT org_id FROM project WHERE id = ?", body.project_id);
  const c = await orgCtx(me, pid?.org_id, req);
  const { p, perm } = await projectIn(c, body.project_id);
  if (!atLeast(perm, "edit")) fail(403, "You can't add tasks here");
  const f = await pick(body, { ...TASK, stage_id: (v) => (v ? ident(v) : null) }, c);
  if (!f.title) bad("Give the task a title");
  await checkTaskRefs(c, f, p.id);
  const internal = c.v.staff && body.internal ? 1 : 0;
  const id = typeof body.id === "string" ? id_(body.id) : uid();
  const stmts = [
    insertTask(c, { ...f, id, project_id: p.id, internal, ord: f.ord ?? now() }),
    act(c, "created", { project_id: p.id, task_id: id, internal }),
    ...notify(c, [f.assignee_id], {
      type: "assign",
      text: `assigned you ${f.title}`,
      project: p,
      task_id: id,
      internal,
    }).stmts,
  ];
  await commit(c, stmts);
  return reread("task", id);
}

async function patchTask(me: Me, id: string, body: Row, req: Request) {
  const { c, row, p, perm } = await load(me, "task", id, req);
  if (!atLeast(perm, "edit")) fail(403, "You can't edit this task");
  const f = await pick(body, { ...TASK, stage_id: (v) => (v ? ident(v) : null), project_id: ident }, c);
  if (c.v.staff && "internal" in body) f.internal = body.internal ? 1 : 0;
  let target = p!;
  if (f.project_id && f.project_id !== row.project_id) {
    const moved = await projectIn(c, f.project_id);
    if (!atLeast(moved.perm, "edit")) fail(403, "You can't move tasks there");
    target = moved.p;
    f.stage_id ??= null;
  } else delete f.project_id;
  await checkTaskRefs(c, f, target.id);

  const internal = f.internal ?? row.internal;
  const ref = { project_id: target.id, task_id: id, internal };
  const stmts: Stmt[] = [];
  const notes: Note[] = [];
  const changed = (k: string) => k in f && JSON.stringify(f[k]) !== JSON.stringify(row[k]);
  const statusName = (s: string) => STATUSES.find((x) => x.id === s)!.name;

  if (changed("status")) {
    if (f.status === "done") {
      f.completed_at = now();
      stmts.push(act(c, "completed", ref));
      if (row.recur && row.due) {
        const next = addDays(row.due, RECUR_DAYS[row.recur as keyof typeof RECUR_DAYS] ?? 7);
        stmts.push(
          insertTask(c, {
            id: uid(),
            project_id: target.id,
            title: row.title,
            priority: row.priority,
            assignee_id: row.assignee_id,
            labels: row.labels,
            description: row.description,
            estimate: row.estimate,
            recur: row.recur,
            internal: row.internal,
            subtasks: JSON.stringify(JSON.parse(row.subtasks).map((s: Row) => ({ ...s, done: false }))),
            start: next,
            due: next,
            ord: row.ord + 0.5,
          }),
        );
      }
    } else {
      f.completed_at = null;
      stmts.push(act(c, "moved", ref, `from ${statusName(row.status)} to ${statusName(f.status)}`));
    }
    notes.push({ type: "update", text: `moved ${row.title} to ${statusName(f.status)}`, task_id: id });
  }
  if (changed("assignee_id")) {
    stmts.push(act(c, "assigned", ref, f.assignee_id ? `to ${nameOf(c, f.assignee_id)}` : "(unassigned)"));
    if (f.assignee_id) stmts.push(...notify(c, [f.assignee_id], { type: "assign", text: `assigned you ${row.title}`, project: target, task_id: id, internal }).stmts);
  }
  if (changed("priority")) stmts.push(act(c, "changed priority of", ref, `to ${PRIOS.find((x) => x.id === f.priority)!.name}`));
  if (changed("due")) stmts.push(act(c, "changed due date of", ref, f.due ? `to ${fmtDay(f.due)}` : "(cleared)"));
  if (changed("start")) stmts.push(act(c, "changed start date of", ref, f.start ? `to ${fmtDay(f.start)}` : "(cleared)"));
  if (changed("project_id")) stmts.push(act(c, "moved", ref, `to ${target.name}`));
  if (changed("labels")) stmts.push(act(c, "updated labels on", ref));
  if (changed("title")) stmts.push(act(c, "renamed", ref, `to “${f.title}”`));
  if (changed("recur")) stmts.push(act(c, "set repeat on", ref, f.recur ? f.recur.toLowerCase() : "off"));
  if (changed("estimate")) stmts.push(act(c, "estimated", ref, f.estimate || "none"));
  if (changed("deps")) stmts.push(act(c, "updated dependencies of", ref));
  if (changed("archived")) stmts.push(act(c, f.archived ? "archived" : "restored", ref));
  if (changed("internal")) stmts.push(act(c, f.internal ? "made internal" : "shared with the client", { ...ref, internal: 1 }));
  if (!Object.keys(f).length) return out("task", row);

  if (f.project_id) {
    // A new home means a new number: WEB-12 becomes APP-3.
    stmts.unshift(
      q(
        "UPDATE task SET project_id = ?, num = (SELECT COALESCE(MAX(num), 0) + 1 FROM task WHERE project_id = ?) WHERE id = ?",
        f.project_id, f.project_id, id,
      ),
    );
    delete f.project_id;
  }
  stmts.unshift(update("task", id, { ...f, updated_at: now() }));
  for (const n of notes)
    stmts.push(...notify(c, [row.assignee_id, row.created_by], { ...n, project: target, internal }).stmts);
  await commit(c, stmts);
  return reread("task", id);
}

async function deleteTask(me: Me, id: string, req: Request) {
  const { c, row, perm } = await load(me, "task", id, req);
  if (!atLeast(perm, "edit")) fail(403, "You can't delete this task");
  await deleteObjects(await all<{ id: string }>("SELECT id FROM file WHERE task_id = ?", id), c.org.id);
  await commit(c, [
    q("DELETE FROM file WHERE task_id = ?", id),
    q("DELETE FROM task WHERE id = ?", id),
    act(c, "deleted", { project_id: row.project_id, internal: row.internal }, `“${row.title}”`),
  ]);
  return { ok: true };
}

/* ---------------------------------------------------------- comments --- */

async function createComment(me: Me, body: Row, req: Request) {
  const proj = await first<{ org_id: string }>("SELECT org_id FROM project WHERE id = ?", body.project_id);
  const c = await orgCtx(me, proj?.org_id, req);
  const { p, perm } = await projectIn(c, body.project_id);
  if (!atLeast(perm, "comment")) fail(403, "You can't comment here");

  let task: Row | null = null;
  let stage: Row | null = null;
  if (body.task_id) {
    task = await first("SELECT * FROM task WHERE id = ? AND project_id = ?", body.task_id, p.id);
    if (!task || !seesRow(c.v, task)) notFound();
  }
  if (body.stage_id) {
    stage = await first("SELECT * FROM stage WHERE id = ? AND project_id = ?", body.stage_id, p.id);
    if (!stage) notFound();
  }
  const text = (await html(20000)(body.body, c)) as string;
  if (!plain(text)) bad("Write something first");
  // Comments on internal tasks are internal too, so they can never leak by accident.
  const internal = task?.internal || (c.v.staff && body.internal) ? 1 : 0;
  const id = typeof body.id === "string" ? id_(body.id) : uid();
  const row = {
    id,
    project_id: p.id,
    task_id: task?.id ?? null,
    stage_id: stage?.id ?? null,
    author_id: c.v.id,
    body: text,
    reactions: "{}",
    internal,
    created_at: now(),
  };
  const what = task?.title ?? stage?.name ?? p.name;
  const base = { project: p, task_id: task?.id, stage_id: stage?.id, internal, snippet: snippet(text) };
  const mentioned = mentions(text);
  const stmts = [
    insert("comment", row),
    act(c, "commented on", { project_id: p.id, task_id: task?.id, stage_id: stage?.id, internal }, task ? "" : what),
    ...notify(c, mentioned, { ...base, type: "mention", text: `mentioned you on ${what}` }).stmts,
    ...notify(
      c,
      [task?.assignee_id, task?.created_by, stage?.owner_id, !task && !stage ? p.lead_id : null].filter(
        (x) => !mentioned.includes(x),
      ),
      { ...base, type: "comment", text: `commented on ${what}` },
    ).stmts,
  ];
  await commit(c, stmts);
  return reread("comment", id);
}

async function patchComment(me: Me, id: string, body: Row, req: Request) {
  const { c, row, perm } = await load(me, "comment", id, req);
  // Reactions: anyone who can comment toggles their own.
  if (typeof body.react === "string") {
    if (!atLeast(perm, "comment")) fail(403, "You can't react here");
    const emoji = [...body.react].slice(0, 2).join("");
    const r: Record<string, string[]> = JSON.parse(row.reactions);
    const list = r[emoji] ?? [];
    r[emoji] = list.includes(c.v.id) ? list.filter((x) => x !== c.v.id) : [...list, c.v.id];
    if (!r[emoji].length) delete r[emoji];
    if (Object.keys(r).length > 20) bad("Too many reactions");
    await commit(c, [update("comment", id, { reactions: JSON.stringify(r) })]);
    return reread("comment", id);
  }
  if (!canEditComment(c.v, row)) fail(403, "Only the author edits a comment");
  const text = (await html(20000)(body.body, c)) as string;
  if (!plain(text)) bad("Write something first");
  await commit(c, [update("comment", id, { body: text, edited_at: now() })]);
  return reread("comment", id);
}

async function deleteComment(me: Me, id: string, req: Request) {
  const { c, row, perm } = await load(me, "comment", id, req);
  if (!canDeleteComment(c.v, row, perm)) fail(403, "You can't delete this comment");
  await commit(c, [q("DELETE FROM comment WHERE id = ?", id)]);
  return { ok: true };
}

/* ------------------------------------------------------------ stages --- */

const STAGE: Record<string, Check> = {
  name: text(80),
  length: optText(40),
  owner_id: person,
  due: day,
  status: oneOf(["todo", "active", "done", "skipped"]),
  gate: oneOf(Object.keys(GATES), true),
  items: checklist("text"),
};

/** A gate just opened: tell the client's owners and admins, by email too. */
function askForSignoff(c: Ctx, p: Row, stage: Row) {
  if (!stage.gate) return [];
  const gate = GATES[stage.gate as keyof typeof GATES];
  const n = notify(c, orgAdmins(c), {
    type: "approval",
    text: `needs your ${gate.label.toLowerCase()} on ${stage.name}`,
    project: p,
    stage_id: stage.id,
  });
  mail(
    c,
    n.to,
    `${p.name}: ${stage.name} is ready for your ${gate.label.toLowerCase()}`,
    `${stage.name} on ${p.name} is waiting for your ${gate.label.toLowerCase()}.\n\nReview it here:\n${link(`/${c.org.slug}/projects/${p.id}/process`)}`,
  );
  return n.stmts;
}

async function patchStage(me: Me, id: string, body: Row, req: Request) {
  const { c, row, p } = await load(me, "stage", id, req);
  // Checklist ticks are shared work; everything else about the process is StayonSite's to run.
  const onlyItems = Object.keys(body).every((k) => k === "items");
  if (!c.v.staff && !(onlyItems && isOrgAdmin(c.v))) fail(403, "Only StayonSite edits the process");
  const f = await pick(body, STAGE, c);
  if (!Object.keys(f).length) return out("stage", row);
  const ref = { project_id: p!.id, stage_id: id };
  const stmts: Stmt[] = [update("stage", id, f)];
  if (f.status && f.status !== row.status) {
    stmts.push(act(c, f.status === "active" ? "started" : f.status === "done" ? "completed" : `marked ${f.status}`, ref, row.name));
  }
  if (f.owner_id && f.owner_id !== row.owner_id) stmts.push(act(c, "handed", ref, `${row.name} to ${nameOf(c, f.owner_id)}`));
  await commit(c, stmts);
  return reread("stage", id);
}

/** The next not-skipped step after `n`, made active. */
async function openNext(c: Ctx, p: Row, n: number) {
  const next = await first("SELECT * FROM stage WHERE project_id = ? AND n > ? AND status = 'todo' ORDER BY n LIMIT 1", p.id, n);
  if (!next) return [];
  return [update("stage", next.id, { status: "active" }), act(c, "started", { project_id: p.id, stage_id: next.id }, next.name)];
}

/** Staff: the document is up, ask the client to sign off (again, after changes were asked for). */
async function requestSignoff(me: Me, id: string, req: Request) {
  const { c, row, p } = await load(me, "stage", id, req);
  if (!c.v.staff) fail(403, "Only StayonSite requests sign-off");
  if (row.status !== "active" || !row.gate) bad("This step isn't waiting on a sign-off");
  if (row.decision === "approved") bad("Already signed off");
  const reset = { decision: null, decided_by: null, decided_at: null, decided_file_id: null, decided_ip: null, decision_note: null };
  await commit(c, [
    update("stage", id, reset),
    act(c, "requested sign-off on", { project_id: p!.id, stage_id: id }, row.name),
    ...askForSignoff(c, p!, row),
  ]);
  return reread("stage", id);
}

async function advanceStage(me: Me, id: string, req: Request) {
  const { c, row, p } = await load(me, "stage", id, req);
  if (!c.v.staff) fail(403, "Only StayonSite moves the process on");
  if (row.status !== "active") bad("Only the current step can be completed");
  if (row.gate && row.decision !== "approved") bad(`Waiting on the client's ${GATES[row.gate as keyof typeof GATES].label.toLowerCase()}`);
  await commit(c, [
    update("stage", id, { status: "done" }),
    act(c, "completed", { project_id: p!.id, stage_id: id }, row.name),
    ...(await openNext(c, p!, row.n)),
  ]);
  return { ok: true };
}

async function decide(me: Me, id: string, body: Row, req: Request) {
  const { c, row, p } = await load(me, "stage", id, req);
  if (!canDecide(c.v, row)) fail(403, "Only the client's owners and admins sign off this step");
  const decision = oneOf(["approved", "rejected"])(body.decision, c) as string;
  const note = optText(2000)(body.note, c) as string | null;
  if (decision === "rejected" && !note) bad("Say what needs to change");
  // Pin the decision to the exact document that was on the step.
  let fileId: string | null = null;
  if (body.file_id) {
    if (!(await first("SELECT 1 FROM file WHERE id = ? AND stage_id = ? AND internal = 0", body.file_id, id))) bad("Unknown document");
    fileId = String(body.file_id);
  } else fileId = (await first<{ id: string }>("SELECT id FROM file WHERE stage_id = ? AND internal = 0 ORDER BY created_at DESC LIMIT 1", id))?.id ?? null;

  const ref = { project_id: p!.id, stage_id: id };
  const verb = decision === "approved" ? { sign: "signed", approve: "approved", go: "gave the go on", accept: "accepted" }[row.gate as string]! : "asked for changes on";
  const stmts: Stmt[] = [
    update("stage", id, {
      decision,
      decided_by: c.v.id,
      decided_at: now(),
      decided_file_id: fileId,
      decided_ip: c.ip,
      decision_note: note,
      ...(decision === "approved" ? { status: "done" } : {}),
    }),
    act(c, verb, ref, row.name),
  ];
  if (note)
    stmts.push(
      insert("comment", { id: uid(), project_id: p!.id, stage_id: id, author_id: c.v.id, body: `<p>${escapeHtml(note)}</p>`, reactions: "{}", internal: 0, created_at: now() }),
    );
  const staffTo = [row.owner_id, p!.lead_id];
  const n = notify(c, staffTo, { type: "approval", text: `${verb} ${row.name}`, snippet: note ?? "", project: p, stage_id: id });
  stmts.push(...n.stmts);
  mail(
    c,
    n.to,
    `${c.org.name} ${verb} ${row.name}`,
    `${nameOf(c, c.v.id)} ${verb} ${row.name} on ${p!.name}.${note ? `\n\n“${note}”` : ""}\n\n${link(`/${c.org.slug}/projects/${p!.id}/process`)}`,
  );
  if (decision === "approved") stmts.push(...(await openNext(c, p!, row.n)));
  await commit(c, stmts);
  return reread("stage", id);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------- files --- */

/** Types a browser may show inline; everything else downloads. */
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

async function upload(me: Me, url: URL, req: Request) {
  const size = Number(req.headers.get("content-length"));
  if (!size || !req.body) fail(411, "Send the file with a Content-Length");
  if (size > MAX_UPLOAD) fail(413, "Files can be up to 95 MB");
  const name = text(200)(url.searchParams.get("name") ?? "", null as never) as string;
  const type = (req.headers.get("content-type") || "application/octet-stream").split(";")[0].slice(0, 100);
  const projectId = url.searchParams.get("project");
  const orgId = projectId
    ? (await first<{ org_id: string }>("SELECT org_id FROM project WHERE id = ?", projectId))?.org_id
    : url.searchParams.get("org");
  const c = await orgCtx(me, orgId, req);

  let p: Row | null = null;
  let internal = c.v.staff && url.searchParams.get("internal") === "1" ? 1 : 0;
  if (projectId) {
    const pr = await projectIn(c, projectId);
    if (!atLeast(pr.perm, "comment")) fail(403, "You can't add files here");
    p = pr.p;
  } else if (!c.v.staff) fail(403, "Only StayonSite adds workspace files");
  const taskId = url.searchParams.get("task");
  const stageId = url.searchParams.get("stage");
  if (taskId) {
    const t = await first("SELECT internal FROM task WHERE id = ? AND project_id = ?", taskId, projectId);
    if (!t || !seesRow(c.v, t)) notFound();
    internal ||= t!.internal;
  }
  if (stageId && !(await first("SELECT 1 FROM stage WHERE id = ? AND project_id = ?", stageId, projectId))) notFound();

  const id = uid();
  await env.FILES.put(`${c.org.id}/${id}`, req.body, { httpMetadata: { contentType: type } });
  await commit(c, [
    insert("file", { id, org_id: c.org.id, project_id: p?.id ?? null, task_id: taskId, stage_id: stageId, name, type, size, internal, uploaded_by: c.v.id, created_at: now() }),
    act(c, "uploaded", { project_id: p?.id, task_id: taskId, stage_id: stageId, internal }, name),
  ]);
  return reread("file", id);
}

async function download(me: Me, id: string, req: Request) {
  const { c, row } = await load(me, "file", id, req);
  if (!row.project_id && !isOrgAdmin(c.v)) notFound();
  if (row.task_id) {
    const t = await first("SELECT internal FROM task WHERE id = ?", row.task_id);
    if (t && !seesRow(c.v, t)) notFound();
  }
  const obj = await env.FILES.get(`${c.org.id}/${id}`);
  if (!obj) notFound();
  const inline = INLINE.has(row.type) && new URL(req.url).searchParams.get("download") !== "1";
  return new Response(obj!.body, {
    headers: {
      "content-type": inline ? row.type : "application/octet-stream",
      "content-length": String(row.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      // Uploaded bytes must never run as a page on stayon.site. PDFs skip the
      // sandbox because it disables the browser's PDF viewer; nosniff and the
      // explicit type still keep them from being read as HTML.
      "x-content-type-options": "nosniff",
      ...(row.type === "application/pdf" && inline ? {} : { "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      "cache-control": "private, max-age=300",
    },
  });
}

async function patchFile(me: Me, id: string, body: Row, req: Request) {
  const { c, row, perm } = await load(me, "file", id, req);
  if (row.uploaded_by !== c.v.id && !c.v.staff && perm !== "full") fail(403, "You can't change this file");
  const f = await pick(body, { name: text(200) }, c);
  if (c.v.staff && "internal" in body) f.internal = body.internal ? 1 : 0;
  if ("task_id" in body) {
    if (body.task_id && !(await first("SELECT 1 FROM task WHERE id = ? AND project_id = ?", body.task_id, row.project_id))) bad("Unknown task");
    f.task_id = body.task_id || null;
  }
  if (Object.keys(f).length) await commit(c, [update("file", id, f)]);
  return reread("file", id);
}

async function deleteObjects(rows: { id: string }[], orgId: string) {
  if (rows.length) await env.FILES.delete(rows.map((r) => `${orgId}/${r.id}`));
}

async function deleteFile(me: Me, id: string, req: Request) {
  const { c, row, perm } = await load(me, "file", id, req);
  if (row.uploaded_by !== c.v.id && !c.v.staff && perm !== "full") fail(403, "You can't delete this file");
  if (await first("SELECT 1 FROM stage WHERE decided_file_id = ?", id)) bad("This document was signed off, so it stays");
  await deleteObjects([row as { id: string }], c.org.id);
  await commit(c, [
    q("DELETE FROM file WHERE id = ?", id),
    act(c, "deleted file", { project_id: row.project_id, task_id: row.task_id, internal: row.internal }, row.name),
  ]);
  return { ok: true };
}

/* --------------------------------------------- events, teams, invoices --- */

const EVENT: Record<string, Check> = { title: text(200), date: day, time };

async function createEvent(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  if (body.project_id) {
    const { perm } = await projectIn(c, body.project_id);
    if (!atLeast(perm, "edit")) fail(403, "You can't add events here");
  } else if (!isOrgAdmin(c.v)) fail(403, "Only admins add workspace events");
  const f = await pick(body, EVENT, c);
  if (!f.title || !f.date) bad("Events need a title and a date");
  const id = uid();
  await commit(c, [insert("event", { ...f, id, org_id: c.org.id, project_id: body.project_id || null, created_by: c.v.id, created_at: now() })]);
  return first("SELECT * FROM event WHERE id = ?", id);
}

async function writeEvent(me: Me, id: string, body: Row | null, req: Request) {
  const { c, row, perm } = await load(me, "event", id, req);
  if (row.created_by !== c.v.id && !(row.project_id ? atLeast(perm, "edit") : isOrgAdmin(c.v))) fail(403, "You can't change this event");
  if (!body) {
    await commit(c, [q("DELETE FROM event WHERE id = ?", id)]);
    return { ok: true };
  }
  const f = await pick(body, EVENT, c);
  if (Object.keys(f).length) await commit(c, [update("event", id, f)]);
  return first("SELECT * FROM event WHERE id = ?", id);
}

const TEAM: Record<string, Check> = {
  name: text(60),
  icon: optText(30),
  color: (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : bad("Expected a colour")),
  description: optText(300),
  lead_id: person,
  members: peopleList,
};

async function createTeam(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  if (!isOrgAdmin(c.v)) fail(403, "Only admins create teams");
  const f = await pick(body, TEAM, c);
  if (!f.name) bad("Give the team a name");
  const id = uid();
  await commit(c, [
    insert("team", { ...f, description: f.description ?? "", icon: f.icon ?? "users", id, org_id: c.org.id, created_at: now() }),
    act(c, "created team", {}, f.name),
  ]);
  return reread("team", id);
}

async function writeTeam(me: Me, id: string, body: Row | null, req: Request) {
  const { c, row } = await load(me, "team", id, req);
  if (!isOrgAdmin(c.v) && row.lead_id !== c.v.id) fail(403, "Only admins and the team lead change a team");
  if (!body) {
    await commit(c, [q("DELETE FROM team WHERE id = ?", id), act(c, "deleted team", {}, row.name)]);
    return { ok: true };
  }
  const f = await pick(body, TEAM, c);
  if (f.description === null) f.description = "";
  if (Object.keys(f).length) await commit(c, [update("team", id, f)]);
  return reread("team", id);
}

const INVOICE: Record<string, Check> = {
  number: text(40),
  amount_cents: cents,
  currency: (v) => (typeof v === "string" && /^[A-Z]{3}$/.test(v) ? v : bad("Expected a currency code like USD")),
  status: oneOf(Object.keys(INVOICE_STATUS)),
  issued: day,
  due: day,
  note: (v) => (v == null ? "" : text(2000)(v, null as never)),
};

async function invoiceRefs(c: Ctx, body: Row, f: Row) {
  if ("project_id" in body)
    f.project_id = body.project_id ? ((await first("SELECT 1 FROM project WHERE id = ? AND org_id = ?", body.project_id, c.org.id)) ? body.project_id : bad("Unknown project")) : null;
  if ("file_id" in body)
    f.file_id = body.file_id ? ((await first("SELECT 1 FROM file WHERE id = ? AND org_id = ?", body.file_id, c.org.id)) ? body.file_id : bad("Unknown file")) : null;
}

function invoiceSent(c: Ctx, inv: Row) {
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency }).format(inv.amount_cents / 100);
  const n = notify(c, orgAdmins(c), { type: "invoice", text: `sent invoice ${inv.number} for ${amount}`, project_id: inv.project_id });
  mail(c, n.to, `Invoice ${inv.number} from StayonSite`, `Invoice ${inv.number} for ${amount}${inv.due ? `, due ${fmtDay(inv.due)}` : ""}.\n\n${link(`/${c.org.slug}/settings/billing`)}`);
  return n.stmts;
}

async function createInvoice(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  if (!c.v.staff) fail(403, "Only StayonSite issues invoices");
  const f = await pick(body, INVOICE, c);
  if (!f.number || f.amount_cents == null) bad("Invoices need a number and an amount");
  await invoiceRefs(c, body, f);
  const id = uid();
  const row = { status: "draft", currency: "USD", issued: today(), ...f, id, org_id: c.org.id, created_at: now() };
  await commit(c, [insert("invoice", row), ...(row.status === "sent" ? invoiceSent(c, row) : [])]);
  return first("SELECT * FROM invoice WHERE id = ?", id);
}

async function writeInvoice(me: Me, id: string, body: Row | null, req: Request) {
  const { c, row } = await load(me, "invoice", id, req);
  if (!c.v.staff) fail(403, "Only StayonSite edits invoices");
  if (!body) {
    if (row.status !== "draft") bad("Only drafts can be deleted; void it instead");
    await commit(c, [q("DELETE FROM invoice WHERE id = ?", id)]);
    return { ok: true };
  }
  const f = await pick(body, INVOICE, c);
  await invoiceRefs(c, body, f);
  if (!Object.keys(f).length) return row;
  const stmts: Stmt[] = [update("invoice", id, f)];
  if (f.status === "sent" && row.status === "draft") stmts.push(...invoiceSent(c, { ...row, ...f }));
  if (f.status && f.status !== row.status) stmts.push(act(c, `marked invoice ${row.number}`, { project_id: row.project_id }, INVOICE_STATUS[f.status as keyof typeof INVOICE_STATUS].toLowerCase()));
  await commit(c, stmts);
  return first("SELECT * FROM invoice WHERE id = ?", id);
}

/* ----------------------------------------- saved views, favorites, notifs --- */

const VIEW: Record<string, Check> = { name: text(60), type: oneOf(VIEW_TYPES), filters };

async function createView(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  const shared = !!body.shared;
  if (body.project_id) {
    const { perm } = await projectIn(c, body.project_id);
    if (shared && !atLeast(perm, "edit")) fail(403, "You can't share views here");
  } else if (shared && !isOrgAdmin(c.v)) fail(403, "Only admins share workspace views");
  const f = await pick(body, VIEW, c);
  if (!f.name || !f.type) bad("Views need a name and a type");
  const id = uid();
  await commit(c, [insert("saved_view", { ...f, id, org_id: c.org.id, project_id: body.project_id || null, user_id: shared ? null : c.v.id, created_at: now() })]);
  return reread("saved_view", id);
}

async function writeView(me: Me, id: string, body: Row | null, req: Request) {
  const { c, row, perm } = await load(me, "saved_view", id, req);
  const mine = row.user_id === c.v.id;
  if (!mine && (row.user_id || !(row.project_id ? atLeast(perm, "edit") : isOrgAdmin(c.v)))) notFound();
  if (!body) {
    await commit(c, [q("DELETE FROM saved_view WHERE id = ?", id)]);
    return { ok: true };
  }
  const f = await pick(body, VIEW, c);
  if (Object.keys(f).length) await commit(c, [update("saved_view", id, f)]);
  return reread("saved_view", id);
}

async function toggleFavorite(me: Me, body: Row, req: Request) {
  const kind = oneOf(["project", "task"])(body.kind, null as never) as string;
  const ref = await first(`SELECT * FROM ${kind} WHERE id = ?`, body.ref_id);
  if (!ref) notFound();
  const orgId = kind === "project" ? ref!.org_id : (await first<{ org_id: string }>("SELECT org_id FROM project WHERE id = ?", ref!.project_id))?.org_id;
  const c = await orgCtx(me, orgId, req);
  await projectIn(c, kind === "project" ? ref!.id : ref!.project_id);
  if (!seesRow(c.v, ref!)) notFound();
  const on = await first("SELECT 1 FROM favorite WHERE user_id = ? AND kind = ? AND ref_id = ?", c.v.id, kind, ref!.id);
  await commit(c, [
    on
      ? q("DELETE FROM favorite WHERE user_id = ? AND kind = ? AND ref_id = ?", c.v.id, kind, ref!.id)
      : insert("favorite", { user_id: c.v.id, org_id: c.org.id, kind, ref_id: ref!.id, created_at: now() }),
  ]);
  return { on: !on };
}

async function patchNotif(me: Me, id: string, body: Row, req: Request) {
  const row = await first("SELECT * FROM notif WHERE id = ? AND user_id = ?", id, me.id);
  if (!row) notFound();
  const c = await orgCtx(me, row!.org_id, req);
  await commit(c, [update("notif", id, { read: body.read ? 1 : 0 })]);
  return { ok: true };
}

async function readAll(me: Me, body: Row, req: Request) {
  const c = await orgCtx(me, body.org_id, req);
  const ids: unknown = body.ids;
  await commit(c, [
    Array.isArray(ids) && ids.length
      ? q(`UPDATE notif SET read = 1 WHERE user_id = ? AND org_id = ? AND id IN (${ids.slice(0, 500).map(() => "?").join(",")})`, me.id, c.org.id, ...ids.slice(0, 500).map(String))
      : q("UPDATE notif SET read = 1 WHERE user_id = ? AND org_id = ?", me.id, c.org.id),
  ]);
  return { ok: true };
}

/* ------------------------------------------------------------- router --- */

export async function portal(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Same-origin only for writes. Better Auth checks its own routes; this covers ours.
  if (req.method !== "GET" && req.headers.get("origin") !== url.origin)
    return Response.json({ error: "Cross-site request" }, { status: 403 });

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const u = session.user as typeof session.user & { role?: string };
  const user: Me = { id: u.id, name: u.name, email: u.email, staff: u.role === "staff" };

  const [, , , resource = "", a = "", b = ""] = url.pathname.split("/");
  const m = req.method;
  const body = async (): Promise<Row> => {
    const j = await req.json().catch(() => null);
    return j && typeof j === "object" && !Array.isArray(j) ? j : bad("Expected a JSON object");
  };

  try {
    const res = await route();
    return res instanceof Response ? res : Response.json(res);
  } catch (e) {
    if (e instanceof Fail) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  async function route(): Promise<unknown> {
    switch (`${m} ${resource}${a ? "/:id" : ""}${b ? `/${["decide", "advance", "request"].includes(b) ? b : ":id"}` : ""}`) {
      case "GET me": return { user, ...(await me(user)) };
      case "GET snapshot": return snapshot(await orgCtx(user, url.searchParams.get("org"), req), req);

      case "POST org": return createOrg(user, await body());
      case "PATCH org/:id": return patchOrg(user, a, await body(), req);
      case "DELETE org/:id": return deleteOrg(user, a, req);

      case "POST invite": return invite(user, await body(), req);
      case "DELETE invite/:id": return revokeInvite(user, a, req);
      case "PATCH member/:id/:id": return setMember(user, a, b, await body(), req);
      case "DELETE member/:id/:id": return setMember(user, a, b, null, req);

      case "POST project": return createProject(user, await body(), req);
      case "PATCH project/:id": return patchProject(user, a, await body(), req);
      case "DELETE project/:id": return deleteProject(user, a, req);

      case "POST task": return createTask(user, await body(), req);
      case "PATCH task/:id": return patchTask(user, a, await body(), req);
      case "DELETE task/:id": return deleteTask(user, a, req);

      case "POST comment": return createComment(user, await body(), req);
      case "PATCH comment/:id": return patchComment(user, a, await body(), req);
      case "DELETE comment/:id": return deleteComment(user, a, req);

      case "PATCH stage/:id": return patchStage(user, a, await body(), req);
      case "POST stage/:id/decide": return decide(user, a, await body(), req);
      case "POST stage/:id/advance": return advanceStage(user, a, req);
      case "POST stage/:id/request": return requestSignoff(user, a, req);

      case "PUT file": return upload(user, url, req);
      case "GET file/:id": return download(user, a, req);
      case "PATCH file/:id": return patchFile(user, a, await body(), req);
      case "DELETE file/:id": return deleteFile(user, a, req);

      case "POST event": return createEvent(user, await body(), req);
      case "PATCH event/:id": return writeEvent(user, a, await body(), req);
      case "DELETE event/:id": return writeEvent(user, a, null, req);

      case "POST team": return createTeam(user, await body(), req);
      case "PATCH team/:id": return writeTeam(user, a, await body(), req);
      case "DELETE team/:id": return writeTeam(user, a, null, req);

      case "POST invoice": return createInvoice(user, await body(), req);
      case "PATCH invoice/:id": return writeInvoice(user, a, await body(), req);
      case "DELETE invoice/:id": return writeInvoice(user, a, null, req);

      case "POST view": return createView(user, await body(), req);
      case "PATCH view/:id": return writeView(user, a, await body(), req);
      case "DELETE view/:id": return writeView(user, a, null, req);

      case "POST favorite": return toggleFavorite(user, await body(), req);
      case "PATCH notif/:id": return patchNotif(user, a, await body(), req);
      case "POST notif/:id": return a === "read-all" ? readAll(user, await body(), req) : notFound();
    }
    return notFound();
  }
}
