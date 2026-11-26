import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { Textarea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import { RiCheckLine, RiDeleteBinLine, RiDownload2Line, RiEyeOffLine, RiUploadCloud2Line } from "@remixicon/react";
import { useId, useRef, useState, type ReactNode } from "react";
import { api, fileUrl, upload } from "../api";
import { INVOICE_STATUS, PCOLORS, PERMS, PICONS, ROLE_NAMES, TEMPLATES } from "../constants";
import { RichEditor } from "../rich";
import { navigate, to } from "../router";
import {
  create, createTask, invite, isAdmin, newId, openProjects, personOf, projectOf, reloadOrgs, remove,
  save, toast, useSnap,
} from "../store";
import type { CalEvent, FileRow, Invoice, Project, Snapshot, Task, Team, Filter, Role } from "../types";
import { FileIcon, ICONS, PersonAvatar, ProjectIcon, fmtSize, isoDay, timeAgo, tint } from "../ui";
import { Sheet, openModal } from "./layer";
import { DatePick, Pick, labelOptions, peopleOptions, priorityOptions, statusOptions } from "./pickers";

/* ----------------------------------------------------------- fields --- */

export function Field({ label, children, hint, className }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <span id={id} className="text-body-medium text-text-primary">
        {label}
      </span>
      {children(id)}
      {hint && <span className="text-caption-1-medium text-text-tertiary">{hint}</span>}
    </div>
  );
}

function Choice<T extends string>({ label, value, onChange, options, className }: { label: string; value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; className?: string }) {
  return (
    <Field label={label} className={className}>
      {(id) => (
        <Select aria-labelledby={id} selectedKey={value} onSelectionChange={(k) => onChange(k as T)}>
          {options.map((o) => (
            <SelectItem key={o.id} id={o.id} textValue={o.label}>
              {o.label}
            </SelectItem>
          ))}
        </Select>
      )}
    </Field>
  );
}

const FIELD_BOX = "flex min-h-10 items-center rounded-2lg border border-border-button-default bg-background-primary-default px-1 shadow-xs";

/* ---------------------------------------------------- confirm / prompt --- */

export function confirm(o: { title: string; body?: ReactNode; action?: string; danger?: boolean }) {
  // A promise settles once, so the later `resolve(false)` from onClose is a no-op after a choice.
  return new Promise<boolean>((resolve) => {
    openModal(
      (close) => (
        <Sheet
          title={o.title}
          onClose={close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button variant={o.danger ? "danger" : "primary"} autoFocus onClick={() => (resolve(true), close())}>
                {o.action ?? "Confirm"}
              </Button>
            </>
          }
        >
          {o.body && <p className="text-body-regular text-text-secondary">{o.body}</p>}
        </Sheet>
      ),
      "sm",
      () => resolve(false),
    );
  });
}

export function promptText(o: { title: string; label: string; value?: string; action?: string; placeholder?: string }) {
  return new Promise<string | null>((resolve) => {
    openModal((close) => <PromptBody {...o} onDone={(v) => (resolve(v), close())} />, "sm", () => resolve(null));
  });
}
function PromptBody({ title, label, value = "", action = "Save", placeholder, onDone }: { title: string; label: string; value?: string; action?: string; placeholder?: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(value);
  return (
    <form onSubmit={(e) => (e.preventDefault(), v.trim() && onDone(v.trim()))}>
      <Sheet
        title={title}
        onClose={() => onDone(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => onDone(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!v.trim()}>
              {action}
            </Button>
          </>
        }
      >
        <Input label={label} value={v} onChange={setV} placeholder={placeholder} autoFocus />
      </Sheet>
    </form>
  );
}

/* --------------------------------------------------------- file preview --- */

export function filePreview(f: FileRow, s: Snapshot) {
  openModal((close) => <FilePreview f={f} s={s} close={close} />, "lg");
}
function FilePreview({ f, s, close }: { f: FileRow; s: Snapshot; close: () => void }) {
  const who = personOf(s, f.uploaded_by);
  const p = projectOf(s, f.project_id);
  const canDelete = f.uploaded_by === s.viewer.id || s.viewer.staff || p?.perm === "full";
  return (
    <Sheet
      title={f.name}
      subtitle={`${fmtSize(f.size)} · ${who?.name ?? "Someone"} · ${timeAgo(f.created_at)}${f.internal ? " · Internal" : ""}`}
      onClose={close}
      footer={
        <>
          {s.viewer.staff && (
            <Button variant="ghost" leadingIcon={RiEyeOffLine} onClick={() => (save("file", f.id, { internal: !f.internal }), close())}>
              {f.internal ? "Share with client" : "Make internal"}
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" leadingIcon={RiDeleteBinLine} onClick={() => (remove("file", f.id), close())}>
              Delete
            </Button>
          )}
          <span className="flex-1" />
          <a href={fileUrl(f.id, true)} className="contents">
            <Button leadingIcon={RiDownload2Line}>Download</Button>
          </a>
        </>
      }
    >
      <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-background-tertiary-default">
        {f.type.startsWith("image/") ? (
          <img src={fileUrl(f.id)} alt={f.name} className="max-h-[60vh] w-auto object-contain" />
        ) : f.type === "application/pdf" ? (
          <iframe title={f.name} src={fileUrl(f.id)} className="h-[60vh] w-full bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileIcon type={f.type} name={f.name} className="size-10" />
            <p className="text-body-regular text-text-secondary">No preview for this file type. Download it to open.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------ new task --- */

export function newTask(defaults: Partial<Task> = {}) {
  openModal((close) => <TaskForm defaults={defaults} close={close} />, "lg");
}
function TaskForm({ defaults, close }: { defaults: Partial<Task>; close: () => void }) {
  const s = useSnap();
  const projects = openProjects(s).filter((p) => p.perm === "edit" || p.perm === "full");
  const [f, setF] = useState<Partial<Task>>({ project_id: projects[0]?.id, status: "todo", priority: "none", labels: [], ...defaults });
  const [title, setTitle] = useState("");
  const [more, setMore] = useState(false);
  const desc = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const p = projectOf(s, f.project_id);
  const submit = () => {
    if (!title.trim()) return setError("Give the task a title");
    if (!p) return setError("Pick a project");
    const description = desc.current?.innerHTML ?? "";
    void createTask({ ...f, project_id: p.id, title: title.trim(), description: description.replace(/<br>$/, "") });
    toast(`Created ${title.trim()}`, { tone: "success" });
    if (more) {
      setTitle("");
      if (desc.current) desc.current.innerHTML = "";
    } else close();
  };
  if (!projects.length)
    return (
      <Sheet title="New task" onClose={close}>
        <p className="text-body-regular text-text-secondary">You don't have edit access to any project yet.</p>
      </Sheet>
    );
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), submit())}>
      <Sheet
        title="New task"
        onClose={close}
        footer={
          <>
            <Checkbox size="sm" isSelected={more} onChange={setMore}>
              Create more
            </Checkbox>
            <span className="flex-1" />
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Create task</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Title" value={title} onChange={(v) => (setTitle(v), setError(null))} placeholder="What needs doing?" autoFocus isInvalid={!!error} hint={error ?? undefined} />
          <RichEditor label="Description" value="" editorRef={desc} people={s.people} placeholder="Add details… type @ to mention" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Pick label="Project" options={projects.map((x) => ({ id: x.id, label: x.name, icon: <ProjectIcon p={x} size="sm" /> }))} value={f.project_id ?? null} onChange={(project_id) => setF({ ...f, project_id, stage_id: null })} className={FIELD_BOX}>
              {p && <ProjectIcon p={p} size="sm" />}
              <span className="text-body-medium text-text-primary">{p?.name ?? "Project"}</span>
            </Pick>
            <Pick label="Status" options={statusOptions} value={f.status!} onChange={(status) => setF({ ...f, status: status as Task["status"] })} className={FIELD_BOX}>
              {statusOptions.find((o) => o.id === f.status)?.icon}
              <span className="text-body-medium text-text-primary">{statusOptions.find((o) => o.id === f.status)?.label}</span>
            </Pick>
            <Pick label="Priority" options={priorityOptions} value={f.priority!} onChange={(priority) => setF({ ...f, priority: priority as Task["priority"] })} className={FIELD_BOX}>
              {priorityOptions.find((o) => o.id === f.priority)?.icon}
              <span className="text-body-medium text-text-primary">{priorityOptions.find((o) => o.id === f.priority)?.label}</span>
            </Pick>
            <Pick label="Assignee" options={peopleOptions(s.people)} value={f.assignee_id ?? ""} onChange={(id) => setF({ ...f, assignee_id: id || null })} className={FIELD_BOX}>
              <PersonAvatar person={personOf(s, f.assignee_id)} size="xs" />
              <span className="text-body-medium text-text-primary">{personOf(s, f.assignee_id)?.name ?? "Assignee"}</span>
            </Pick>
            <span className={FIELD_BOX}>
              <DatePick value={f.due ?? null} label="Due date" placeholder="Due date" onChange={(due) => setF({ ...f, due })} />
            </span>
            <Pick label="Labels" multi options={labelOptions} value={f.labels ?? []} onChange={(l) => setF({ ...f, labels: f.labels!.includes(l) ? f.labels!.filter((x) => x !== l) : [...f.labels!, l] })} className={FIELD_BOX}>
              <span className="text-body-medium text-text-primary">{f.labels?.length ? `${f.labels.length} label${f.labels.length > 1 ? "s" : ""}` : "Labels"}</span>
            </Pick>
          </div>
          {s.viewer.staff && (
            <Switch size="sm" isSelected={!!f.internal} onChange={(internal) => setF({ ...f, internal })}>
              Internal: only StayonSite sees this task
            </Switch>
          )}
        </div>
      </Sheet>
    </form>
  );
}

/* ------------------------------------------------------------- project --- */

export function projectModal(edit?: Project) {
  openModal((close) => <ProjectForm edit={edit} close={close} />, "lg");
}
function ProjectForm({ edit, close }: { edit?: Project; close: () => void }) {
  const s = useSnap();
  const [f, setF] = useState({
    name: edit?.name ?? "",
    description: edit?.description ?? "",
    icon: edit?.icon ?? "folder",
    color: edit?.color ?? "indigo",
    team_id: edit?.team_id ?? "",
    lead_id: edit?.lead_id ?? s.viewer.id,
    start: edit?.start ?? isoDay(new Date()),
    due: edit?.due ?? null,
    private: edit?.private ?? false,
    template: s.viewer.staff ? "engagement" : "blank",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const submit = async () => {
    if (!f.name.trim()) return setError("Give the project a name");
    const fields = { ...f, name: f.name.trim(), team_id: f.team_id || null, description: f.description ? `<p>${f.description.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>` : "" };
    if (edit) {
      const { template: _t, description: _d, ...patch } = fields;
      void _t;
      void _d;
      void save("project", edit.id, patch);
      return close();
    }
    const id = newId();
    const made = await create("project", { ...fields, id });
    if (made) {
      close();
      navigate(to(s.org.slug, `projects/${id}/${f.template === "engagement" ? "process" : f.template === "blank" ? "overview" : "board"}`));
    }
  };
  const templates = TEMPLATES.filter((t) => t.id !== "engagement" || s.viewer.staff);
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title={edit ? "Project settings" : "New project"}
        subtitle={edit ? undefined : "Projects hold the process, tasks, files and conversations for one body of work."}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{edit ? "Save changes" : "Create project"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <ProjectIcon p={{ icon: f.icon, color: f.color }} size="lg" className="mt-7" />
            <Input className="flex-1" label="Project name" value={f.name} onChange={(name) => (set({ name }), setError(null))} placeholder="e.g. Support triage agent" autoFocus isInvalid={!!error} hint={error ?? undefined} />
          </div>
          {!edit && <Textarea label="Description" value={f.description} onChange={(description) => set({ description })} placeholder="What is this project about?" rows={2} />}
          <div className="flex flex-wrap gap-6">
            <Field label="Icon" className="min-w-0 flex-1">
              {(id) => (
                <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1">
                  {PICONS.map((i) => {
                    const Icon = ICONS[i];
                    return (
                      <button key={i} type="button" role="radio" aria-checked={f.icon === i} aria-label={i} onClick={() => set({ icon: i })} className={cx("flex size-8 items-center justify-center rounded-lg border", f.icon === i ? "border-border-button-active bg-background-secondary-hover" : "border-transparent hover:bg-background-secondary-hover")}>
                        <Icon className="size-4 text-foreground-icon-secondary" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>
            <Field label="Colour">
              {(id) => (
                <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-4 gap-1.5">
                  {Object.keys(PCOLORS).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} onClick={() => set({ color: c as Project["color"] })} style={tint(c)} className="flex size-6 items-center justify-center rounded-full bg-[var(--c)] ring-offset-2 ring-offset-background-primary-default aria-checked:ring-2 aria-checked:ring-border-button-active">
                      {f.color === c && <RiCheckLine className="size-3.5 text-text-white" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Choice label="Lead" value={f.lead_id ?? ""} onChange={(lead_id) => set({ lead_id })} options={s.people.map((p) => ({ id: p.id, label: p.name }))} />
            <Choice label="Team" value={f.team_id ?? ""} onChange={(team_id) => set({ team_id })} options={[{ id: "", label: "No team" }, ...s.teams.map((t) => ({ id: t.id, label: t.name }))]} />
            <Field label="Start date">{() => <span className={FIELD_BOX}><DatePick value={f.start} label="Start date" onChange={(start) => set({ start: start ?? "" })} /></span>}</Field>
            <Field label="Target date">{() => <span className={FIELD_BOX}><DatePick value={f.due} label="Target date" onChange={(due) => set({ due })} /></span>}</Field>
          </div>
          {!edit && (
            <Field label="Template">
              {(id) => (
                <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-3">
                  {templates.map((t) => {
                    const Icon = ICONS[t.icon];
                    return (
                      <button key={t.id} type="button" role="radio" aria-checked={f.template === t.id} onClick={() => set({ template: t.id })} className={cx("flex flex-col items-start gap-1 rounded-2xl border p-3 text-start", f.template === t.id ? "border-border-button-active bg-background-secondary-hover" : "border-border-button-default hover:border-border-button-hover")}>
                        <Icon className="size-4 text-foreground-icon-secondary" aria-hidden />
                        <span className="text-body-medium text-text-primary">{t.name}</span>
                        <span className="text-caption-1-medium text-text-tertiary">{t.tasks.length ? `${t.tasks.length} starter tasks` : t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>
          )}
          <Switch size="sm" isSelected={f.private} onChange={(v) => set({ private: v })}>
            Private: only people added to the project can see it
          </Switch>
        </div>
      </Sheet>
    </form>
  );
}

/* --------------------------------------------------------------- share --- */

export function shareModal(p: Project) {
  openModal((close) => <ShareBody id={p.id} close={close} />);
}
function ShareBody({ id, close }: { id: string; close: () => void }) {
  const s = useSnap();
  const p = projectOf(s, id);
  if (!p) return null;
  const members = Object.entries(p.members);
  const others = s.people.filter((x) => !(x.id in p.members) && !x.staff);
  const setPerm = (uid: string, perm: string | null) => {
    const next = { ...p.members };
    if (perm) next[uid] = perm as Project["members"][string];
    else delete next[uid];
    void save("project", p.id, { members: next });
  };
  return (
    <Sheet title={`Share “${p.name}”`} onClose={close} footer={<Button onClick={close}>Done</Button>}>
      <div className="flex flex-col gap-5">
        <Switch size="sm" isSelected={p.private} onChange={(v) => save("project", p.id, { private: v })}>
          Private: only the people below (and StayonSite) can see it
        </Switch>
        {!p.private && <p className="text-body-regular text-text-secondary">Everyone in {s.org.name} can see this project. Admins can edit, members can comment. Guests need to be added.</p>}
        <div className="flex flex-col gap-1">
          <p className="text-body-medium text-text-secondary">People with access</p>
          {members.length === 0 && <p className="py-2 text-body-regular text-text-tertiary">No one added yet.</p>}
          {members.map(([uid, perm]) => {
            const who = personOf(s, uid);
            return (
              <div key={uid} className="flex items-center gap-3 py-1.5">
                <PersonAvatar person={who} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-medium text-text-primary">{who?.name ?? "Former member"}</span>
                  <span className="truncate text-caption-1-medium text-text-tertiary">{who?.email}</span>
                </span>
                <Pick label="Permission" options={[...PERMS.map((x) => ({ id: x.id, label: x.name })), { id: "", label: "Remove" }]} value={perm} onChange={(v) => setPerm(uid, v || null)}>
                  <span className="text-body-medium text-text-secondary">{PERMS.find((x) => x.id === perm)?.name}</span>
                </Pick>
              </div>
            );
          })}
        </div>
        {others.length > 0 && (
          <Pick label="Add people" options={others.map((x) => ({ id: x.id, label: x.name, icon: <PersonAvatar person={x} size="xs" /> }))} value={null} onChange={(uid) => setPerm(uid, "edit")} className={cx(FIELD_BOX, "w-full justify-start px-3")}>
            <span className="text-body-medium text-text-tertiary">Add someone from {s.org.name}…</span>
          </Pick>
        )}
        {isAdmin(s) && (
          <p className="text-body-regular text-text-secondary">
            Someone new?{" "}
            <button className="text-accent-500 underline" onClick={() => (close(), inviteModal())}>
              Invite them to the workspace
            </button>{" "}
            first.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------- invite --- */

export function inviteModal(staff = false) {
  openModal((close) => <InviteForm staffDefault={staff} close={close} />);
}
function InviteForm({ staffDefault, close }: { staffDefault: boolean; close: () => void }) {
  const s = useSnap();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [asStaff, setAsStaff] = useState(staffDefault);
  const [busy, setBusy] = useState(false);
  const owner = s.viewer.staff || s.viewer.role === "owner";
  const roles = (["owner", "admin", "member", "guest"] as const).filter((r) => r !== "owner" || owner);
  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const valid = list.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const submit = async () => {
    if (!list.length || !valid) return;
    setBusy(true);
    let ok = 0;
    for (const e of list) if ((await invite(e, role, undefined, asStaff)) !== undefined) ok++;
    setBusy(false);
    if (ok) {
      toast(`Invited ${ok} ${ok === 1 ? "person" : "people"}`, { tone: "success" });
      close();
    }
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title={asStaff ? "Add StayonSite team members" : `Invite people to ${s.org.name}`}
        subtitle={asStaff ? "Staff see every client workspace and internal work." : "They get an email and sign in with a code or their company SSO."}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!list.length || !valid || busy}>
              Send {list.length > 1 ? `${list.length} invites` : "invite"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Textarea label="Emails" value={emails} onChange={setEmails} placeholder="ana@acme.com, ben@acme.com" rows={3} autoFocus hint={!valid && list.length ? "One of these isn't an email address." : "Separate several with commas."} />
          {!asStaff && <Choice label="Role" value={role} onChange={setRole} options={roles.map((r) => ({ id: r, label: `${ROLE_NAMES[r]}: ${ROLE_HELP[r]}` }))} />}
          {s.viewer.staff && (
            <Switch size="sm" isSelected={asStaff} onChange={setAsStaff}>
              StayonSite team member (not a client)
            </Switch>
          )}
        </div>
      </Sheet>
    </form>
  );
}
export const ROLE_HELP: Record<Role, string> = {
  owner: "everything, including billing and sign-offs",
  admin: "manages people and projects, signs off steps",
  member: "sees shared projects, comments and uploads",
  guest: "only projects they're added to",
};

/* ---------------------------------------------------------------- team --- */

export function teamModal(edit?: Team) {
  openModal((close) => <TeamForm edit={edit} close={close} />);
}
function TeamForm({ edit, close }: { edit?: Team; close: () => void }) {
  const s = useSnap();
  const [f, setF] = useState({ name: edit?.name ?? "", description: edit?.description ?? "", icon: edit?.icon ?? "users", color: edit?.color ?? PCOLORS.blue, lead_id: edit?.lead_id ?? s.viewer.id, members: edit?.members ?? [s.viewer.id] });
  const submit = () => {
    if (!f.name.trim()) return;
    if (edit) void save("team", edit.id, f);
    else void create("team", f);
    close();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title={edit ? "Team settings" : "New team"}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{edit ? "Save" : "Create team"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Name" value={f.name} onChange={(name) => setF({ ...f, name })} autoFocus placeholder="e.g. Operations" />
          <Input label="Description" value={f.description} onChange={(description) => setF({ ...f, description })} placeholder="What does this team look after?" />
          <div className="flex flex-wrap gap-6">
            <Field label="Colour">
              {(id) => (
                <div role="radiogroup" aria-labelledby={id} className="flex gap-1.5">
                  {Object.values(PCOLORS).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })} style={tint(c)} className="size-6 rounded-full bg-[var(--c)] ring-offset-2 ring-offset-background-primary-default aria-checked:ring-2 aria-checked:ring-border-button-active" />
                  ))}
                </div>
              )}
            </Field>
            <Choice label="Lead" value={f.lead_id ?? ""} onChange={(lead_id) => setF({ ...f, lead_id })} options={s.people.map((p) => ({ id: p.id, label: p.name }))} className="min-w-48" />
          </div>
          <Field label="Members">
            {() => (
              <Pick label="Members" multi options={s.people.map((p) => ({ id: p.id, label: p.name, icon: <PersonAvatar person={p} size="xs" /> }))} value={f.members} onChange={(id) => setF({ ...f, members: f.members.includes(id) ? f.members.filter((x) => x !== id) : [...f.members, id] })} className={cx(FIELD_BOX, "w-full justify-start px-2")}>
                <span className="flex flex-wrap gap-1">
                  {f.members.map((id) => (
                    <PersonAvatar key={id} person={personOf(s, id)} size="sm" />
                  ))}
                  <span className="ms-1 text-body-medium text-text-tertiary">{f.members.length} members</span>
                </span>
              </Pick>
            )}
          </Field>
        </div>
      </Sheet>
    </form>
  );
}

/* ----------------------------------------------------------- save view --- */

export function saveViewModal(projectId: string | null, type: "board" | "list" | "table" | "calendar" | "timeline", filters: Filter[]) {
  openModal((close) => <SaveView projectId={projectId} type={type} filters={filters} close={close} />, "sm");
}
function SaveView({ projectId, type, filters, close }: { projectId: string | null; type: "board" | "list" | "table" | "calendar" | "timeline"; filters: Filter[]; close: () => void }) {
  const s = useSnap();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const canShare = projectId ? ["edit", "full"].includes(projectOf(s, projectId)?.perm ?? "") : isAdmin(s);
  const submit = async () => {
    if (!name.trim()) return;
    const id = newId();
    const made = await create("view", { id, project_id: projectId, name: name.trim(), type, filters, shared } as never);
    close();
    if (made && projectId) navigate(to(s.org.slug, `projects/${projectId}/v:${id}`));
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title="Save view"
        subtitle={`${filters.length} filter${filters.length === 1 ? "" : "s"} on the ${type} view.`}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save view
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={setName} placeholder="e.g. Waiting on client" autoFocus />
          {canShare && (
            <Switch size="sm" isSelected={shared} onChange={setShared}>
              Share with everyone on the project
            </Switch>
          )}
        </div>
      </Sheet>
    </form>
  );
}

/* ----------------------------------------------------------- shortcuts --- */

export const SHORTCUTS: [string, string[]][] = [
  ["Open search and commands", ["⌘", "K"]],
  ["Search", ["/"]],
  ["New task", ["N"]],
  ["New project", ["P"]],
  ["Toggle sidebar", ["["]],
  ["Toggle dark mode", ["⌘", "⇧", "L"]],
  ["Edit the open task's title", ["E"]],
  ["Set status of the open task", ["1–5"]],
  ["Close the top layer", ["Esc"]],
  ["Submit a form or comment", ["⌘", "Enter"]],
  ["Go to Home", ["G", "H"]],
  ["Go to My Tasks", ["G", "T"]],
  ["Go to Projects", ["G", "P"]],
  ["Go to Inbox", ["G", "I"]],
  ["Go to Calendar", ["G", "C"]],
  ["Go to Notifications", ["G", "N"]],
  ["Go to Activity", ["G", "A"]],
  ["Go to Members", ["G", "M"]],
  ["Go to Settings", ["G", "S"]],
  ["Show shortcuts", ["?"]],
];
export function shortcutsModal() {
  openModal(
    (close) => (
      <Sheet title="Keyboard shortcuts" onClose={close}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5">
          {SHORTCUTS.map(([what, keys]) => (
            <div key={what} className="contents">
              <dt className="text-body-regular text-text-secondary">{what}</dt>
              <dd className="flex justify-end gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Sheet>
    ),
    "md",
  );
}

/* ------------------------------------------------- new client (staff) --- */

export function clientModal() {
  openModal((close) => <ClientForm close={close} />, "sm");
}
function ClientForm({ close }: { close: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const org = await api<{ id: string; slug: string }>("POST", "org", { name: name.trim() });
      await reloadOrgs();
      close();
      navigate(to(org.slug));
      toast(`Added ${name.trim()}. Next: start an engagement and invite their team.`, { tone: "success" });
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title="Add a client"
        subtitle="Each client gets its own workspace. Only their people and StayonSite can see it."
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              Add client
            </Button>
          </>
        }
      >
        <Input label="Company name" value={name} onChange={setName} placeholder="e.g. Acme Logistics" autoFocus />
      </Sheet>
    </form>
  );
}

/* ------------------------------------------------- invoice (staff) --- */

export function invoiceModal(edit?: Invoice) {
  openModal((close) => <InvoiceForm edit={edit} close={close} />);
}
function InvoiceForm({ edit, close }: { edit?: Invoice; close: () => void }) {
  const s = useSnap();
  const n = s.invoices.length + 1;
  const [f, setF] = useState({
    number: edit?.number ?? `INV-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`,
    amount: edit ? String(edit.amount_cents / 100) : "",
    currency: edit?.currency ?? "USD",
    status: edit?.status ?? "draft",
    issued: edit?.issued ?? isoDay(new Date()),
    due: edit?.due ?? null,
    project_id: edit?.project_id ?? "",
    note: edit?.note ?? "",
    file_id: edit?.file_id ?? null,
  });
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = Math.round(Number(f.amount) * 100);
  const submit = async () => {
    if (!f.number.trim() || !Number.isFinite(amount) || amount < 0) return;
    setBusy(true);
    let file_id = f.file_id;
    if (pdf) {
      const row = await upload<FileRow>({ org: s.org.id, project: f.project_id || null }, pdf).catch((e) => (toast(e.message, { tone: "error" }), null));
      if (!row) return setBusy(false);
      file_id = row.id;
    }
    const fields = { number: f.number.trim(), amount_cents: amount, currency: f.currency, status: f.status, issued: f.issued, due: f.due, project_id: f.project_id || null, note: f.note, file_id };
    const r = edit ? await save("invoice", edit.id, fields as Partial<Invoice>) : await create("invoice", fields as Partial<Invoice>);
    setBusy(false);
    if (r) close();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title={edit ? `Invoice ${edit.number}` : "New invoice"}
        subtitle="Clients' owners and admins see sent invoices and get an email when one is sent."
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {edit ? "Save" : "Create invoice"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Number" value={f.number} onChange={(number) => setF({ ...f, number })} />
          <div className="flex gap-2">
            <Input className="flex-1" label="Amount" value={f.amount} onChange={(amount) => setF({ ...f, amount })} placeholder="14000" inputMode="decimal" />
            <Choice label="Currency" value={f.currency} onChange={(currency) => setF({ ...f, currency })} options={["USD", "EUR", "GBP", "INR", "AUD", "CAD"].map((c) => ({ id: c, label: c }))} />
          </div>
          <Choice label="Status" value={f.status} onChange={(status) => setF({ ...f, status })} options={Object.entries(INVOICE_STATUS).map(([id, label]) => ({ id: id as Invoice["status"], label }))} />
          <Choice label="Project" value={f.project_id} onChange={(project_id) => setF({ ...f, project_id })} options={[{ id: "", label: "No project" }, ...openProjects(s).map((p) => ({ id: p.id, label: p.name }))]} />
          <Field label="Issued">{() => <span className={FIELD_BOX}><DatePick value={f.issued} label="Issued" onChange={(issued) => setF({ ...f, issued: issued ?? isoDay(new Date()) })} /></span>}</Field>
          <Field label="Due">{() => <span className={FIELD_BOX}><DatePick value={f.due} label="Due" onChange={(due) => setF({ ...f, due })} /></span>}</Field>
          <Textarea className="sm:col-span-2" label="Note" value={f.note} onChange={(note) => setF({ ...f, note })} rows={2} placeholder="e.g. Discovery sprint, 50% deposit" />
          <Field label="PDF" className="sm:col-span-2">
            {() => (
              <label className={cx(FIELD_BOX, "cursor-pointer gap-2 px-3")}>
                <RiUploadCloud2Line className="size-4 text-foreground-icon-tertiary" aria-hidden />
                <span className="truncate text-body-medium text-text-secondary">{pdf?.name ?? (f.file_id ? "Replace the attached PDF" : "Attach the invoice PDF")}</span>
                <input type="file" accept="application/pdf" hidden onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </Field>
        </div>
      </Sheet>
    </form>
  );
}

/* ---------------------------------------------------------------- event --- */

export function eventModal(defaults: Partial<CalEvent> = {}, edit?: CalEvent) {
  openModal((close) => <EventForm defaults={defaults} edit={edit} close={close} />, "sm");
}
function EventForm({ defaults, edit, close }: { defaults: Partial<CalEvent>; edit?: CalEvent; close: () => void }) {
  const s = useSnap();
  const [f, setF] = useState({ title: edit?.title ?? "", date: edit?.date ?? defaults.date ?? isoDay(new Date()), time: edit?.time ?? "", project_id: edit?.project_id ?? defaults.project_id ?? "" });
  const submit = () => {
    if (!f.title.trim()) return;
    const fields = { ...f, title: f.title.trim(), time: f.time || null, project_id: f.project_id || null };
    if (edit) void save("event", edit.id, fields);
    else void create("event", fields);
    close();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title={edit ? "Edit event" : "New event"}
        onClose={close}
        footer={
          <>
            {edit && (
              <Button variant="ghost" leadingIcon={RiDeleteBinLine} onClick={() => (remove("event", edit.id), close())}>
                Delete
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{edit ? "Save" : "Add event"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Title" value={f.title} onChange={(title) => setF({ ...f, title })} placeholder="e.g. Weekly demo" autoFocus />
          <div className="flex gap-3">
            <Field label="Date" className="flex-1">{() => <span className={FIELD_BOX}><DatePick value={f.date} label="Date" onChange={(date) => setF({ ...f, date: date ?? f.date })} /></span>}</Field>
            <Input label="Time" type="time" value={f.time} onChange={(time) => setF({ ...f, time })} />
          </div>
          <Choice label="Project" value={f.project_id} onChange={(project_id) => setF({ ...f, project_id })} options={[{ id: "", label: "Whole workspace" }, ...openProjects(s).filter((p) => p.perm === "edit" || p.perm === "full").map((p) => ({ id: p.id, label: p.name }))]} />
        </div>
      </Sheet>
    </form>
  );
}

/* ------------------------------------------------------------ milestone --- */

export function milestoneModal(p: Project) {
  openModal((close) => <MilestoneForm p={p} close={close} />, "sm");
}
function MilestoneForm({ p, close }: { p: Project; close: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const submit = () => {
    if (!name.trim()) return;
    void save("project", p.id, { milestones: [...p.milestones, { id: newId(), name: name.trim(), date }] });
    close();
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Sheet
        title="Add milestone"
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={setName} placeholder="e.g. Prototype demo" autoFocus />
          <Field label="Date">{() => <span className={FIELD_BOX}><DatePick value={date} label="Milestone date" onChange={setDate} /></span>}</Field>
        </div>
      </Sheet>
    </form>
  );
}

