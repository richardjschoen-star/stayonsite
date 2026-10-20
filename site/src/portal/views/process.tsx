import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Textarea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import {
  RiAddLine, RiArrowGoBackLine, RiCheckLine, RiCheckboxCircleFill, RiCloseLine, RiInformationLine,
  RiFileTextLine, RiQuillPenLine, RiSendPlane2Line, RiShakeHandsLine, RiSkipForwardLine, RiTimeLine,
} from "@remixicon/react";
import { useState } from "react";
import { fileUrl } from "../api";
import { GATES } from "../../process";
import { Attachments, Progress, Thread } from "../overlays/drawer";
import { Sheet, openModal } from "../overlays/layer";
import { newTask } from "../overlays/modals";
import { DatePick, Pick, peopleOptions } from "../overlays/pickers";
import { canEdit, newId, personOf, save, stageAction, tasksOf, useSnap } from "../store";
import type { Project, Snapshot, Stage } from "../types";
import { Empty, PersonAvatar, StatusIcon, fmtDay, relDay } from "../ui";
import { RiFlowChart } from "@remixicon/react";
import { navigate, withTask } from "../router";

const GATE_ICON = { sign: RiQuillPenLine, approve: RiCheckLine, go: RiSendPlane2Line, accept: RiShakeHandsLine } as const;

/** When did StayonSite last ask for this step's sign-off (after any decision)? */
function requestedAt(s: Snapshot, st: Stage) {
  const ask = s.activity.filter((a) => a.stage_id === st.id && a.verb === "requested sign-off on").map((a) => a.at);
  const last = ask.length ? Math.max(...ask) : null;
  return last && (!st.decided_at || last > st.decided_at) ? last : null;
}

export type StageState = "done" | "skipped" | "todo" | "waiting-client" | "changes" | "preparing" | "active";
export function stageState(s: Snapshot, st: Stage): StageState {
  if (st.status === "done") return "done";
  if (st.status === "skipped") return "skipped";
  if (st.status === "todo") return "todo";
  if (st.gate && st.decision === "rejected" && !requestedAt(s, st)) return "changes";
  if (st.gate && requestedAt(s, st)) return "waiting-client";
  return st.gate ? "preparing" : "active";
}
const STATE_LABEL: Record<StageState, string> = {
  done: "Done", skipped: "Skipped", todo: "Up next", "waiting-client": "Waiting on client", changes: "Changes requested", preparing: "In progress", active: "In progress",
};

function StepDot({ state, n }: { state: StageState; n: number }) {
  if (state === "done") return <RiCheckboxCircleFill className="size-6 shrink-0 text-status-lime-text" aria-hidden />;
  if (state === "skipped") return <RiSkipForwardLine className="size-6 shrink-0 text-foreground-icon-quaternary" aria-hidden />;
  if (state === "todo") return <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-button-default text-caption-1-semibold text-text-tertiary">{n}</span>;
  return (
    <span className={cx("relative flex size-6 shrink-0 items-center justify-center rounded-full text-caption-1-semibold text-text-white", state === "waiting-client" ? "bg-status-orange-text" : state === "changes" ? "bg-status-rose-text" : "bg-accent-500")}>
      {n}
      <span className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-30 motion-reduce:hidden" />
    </span>
  );
}

/** The engagement, step by step, with the client sign-offs in the middle of it. */
export function ProcessView({ p }: { p: Project }) {
  const s = useSnap();
  const stages = s.stages.filter((x) => x.project_id === p.id).sort((a, b) => a.n - b.n);
  const current = stages.find((x) => x.status === "active") ?? stages.find((x) => x.status === "todo") ?? stages.at(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const st = stages.find((x) => x.id === picked) ?? current;

  if (!stages.length)
    return <Empty icon={RiFlowChart} title="No process on this project" body="Projects started from the Engagement template walk the 11 steps from inquiry to operate, with sign-offs. Ask StayonSite to set one up." />;

  const done = stages.filter((x) => x.status === "done" || x.status === "skipped").length;
  return (
    <div className="flex flex-col gap-5 px-4 sm:px-8">
      <div className="flex flex-col gap-2 rounded-3xl border border-border-button-default p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-headline-medium text-text-primary">
            {current && current.status !== "done" ? (
              <>
                Step {current.n} of {stages.length}: {current.name}
              </>
            ) : (
              "Every step is complete"
            )}
          </p>
          {current && <span className="text-body-medium text-text-secondary">{STATE_LABEL[stageState(s, current)]}</span>}
        </div>
        <Progress pct={Math.round((done / stages.length) * 100)} />
        <div className="flex gap-1 pt-1">
          {stages.map((x) => (
            <button key={x.id} title={`${x.n}. ${x.name}`} onClick={() => setPicked(x.id)} className={cx("h-1.5 flex-1 rounded-full", x.status === "done" ? "bg-status-lime-text" : x.status === "active" ? "bg-accent-500" : x.status === "skipped" ? "bg-foreground-icon-quaternary" : "bg-background-tertiary-default")} />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Steps" className="flex flex-col gap-4">
          {(["sales", "delivery"] as const).map((phase) => (
            <div key={phase} className="flex flex-col">
              <p className="px-2 pb-1.5 text-caption-1-semibold text-text-tertiary">{phase === "sales" ? "Getting started" : "Delivery"}</p>
              <ol className="flex flex-col">
                {stages.filter((x) => x.phase === phase).map((x) => {
                  const state = stageState(s, x);
                  return (
                    <li key={x.id}>
                      <button onClick={() => setPicked(x.id)} aria-current={st?.id === x.id ? "step" : undefined} className={cx("flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start", st?.id === x.id ? "bg-background-secondary-default" : "hover:bg-background-secondary-default")}>
                        <StepDot state={state} n={x.n} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={cx("truncate text-body-medium", state === "todo" || state === "skipped" ? "text-text-secondary" : "text-text-primary")}>{x.name}</span>
                          <span className="truncate text-caption-1-medium text-text-tertiary">
                            {x.gate ? `${GATES[x.gate].label} · ` : ""}
                            {state === "todo" ? x.length : STATE_LABEL[state]}
                          </span>
                        </span>
                        {x.gate && state === "waiting-client" && <span className="size-2 rounded-full bg-status-orange-text" aria-label="Waiting on client" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>
        {st && <StageDetail key={st.id} st={st} p={p} s={s} />}
      </div>
    </div>
  );
}

function StageDetail({ st, p, s }: { st: Stage; p: Project; s: Snapshot }) {
  const staff = s.viewer.staff;
  const clientAdmin = !staff && (s.viewer.role === "owner" || s.viewer.role === "admin");
  const state = stageState(s, st);
  const tasks = tasksOf(s, p.id).filter((t) => t.stage_id === st.id);
  const owner = personOf(s, st.owner_id);
  const [item, setItem] = useState("");
  const setItems = (items: Stage["items"]) => save("stage", st.id, { items });
  const ticks = clientAdmin || staff;

  return (
    <section aria-label={st.name} className="flex min-w-0 flex-col gap-6 rounded-3xl border border-border-button-default p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-caption-1-semibold text-text-tertiary">
            Step {st.n} · {st.phase === "sales" ? "Getting started" : "Delivery"} · {st.length}
          </p>
          <h2 className="mt-1 text-title-2-medium text-text-primary">{st.name}</h2>
        </div>
        {staff && (
          <div className="flex flex-wrap gap-2">
            {st.status === "todo" && (
              <Button size="small" variant="secondary" onClick={() => save("stage", st.id, { status: "active" })}>
                Start step
              </Button>
            )}
            {st.status === "active" && (!st.gate || st.decision === "approved") && (
              <Button size="small" leadingIcon={RiCheckLine} onClick={() => stageAction(st, "advance")}>
                Complete step
              </Button>
            )}
            {(st.status === "todo" || st.status === "active") && (
              <Button size="small" variant="ghost" leadingIcon={RiSkipForwardLine} onClick={() => save("stage", st.id, { status: "skipped" })}>
                Skip
              </Button>
            )}
            {(st.status === "done" || st.status === "skipped") && (
              <Button size="small" variant="ghost" leadingIcon={RiArrowGoBackLine} onClick={() => save("stage", st.id, { status: "active" })}>
                Reopen
              </Button>
            )}
          </div>
        )}
      </header>

      <dl className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[100px_minmax(0,1fr)_100px_minmax(0,1fr)]">
        <dt className="text-body-medium text-text-secondary">Owner</dt>
        <dd>
          <Pick label="Owner" disabled={!staff} options={peopleOptions(s.people.filter((x) => x.staff), "No owner")} value={st.owner_id ?? ""} onChange={(id) => save("stage", st.id, { owner_id: id || null })}>
            <PersonAvatar person={owner} size="xs" />
            <span className="text-body-medium text-text-primary">{owner?.name ?? "No owner"}</span>
          </Pick>
        </dd>
        <dt className="text-body-medium text-text-secondary">Due</dt>
        <dd>
          <DatePick value={st.due} label="Step due date" disabled={!staff} placeholder="No date" onChange={(due) => save("stage", st.id, { due })} />
        </dd>
      </dl>

      {st.gate && <GateCard st={st} p={p} s={s} state={state} />}

      <section className="flex flex-col gap-2">
        <h3 className="text-headline-medium text-text-primary">{st.phase === "delivery" ? "What you get" : "Checklist"}</h3>
        <ul className="flex flex-col">
          {st.items.map((it) => (
            <li key={it.id} className="group flex items-center gap-2 py-1">
              <Checkbox size="sm" isSelected={it.done} isDisabled={!ticks} onChange={(v) => setItems(st.items.map((x) => (x.id === it.id ? { ...x, done: v } : x)))}>
                <span className={cx("text-body-regular", it.done ? "text-text-tertiary line-through" : "text-text-primary")}>{it.text}</span>
              </Checkbox>
              {staff && (
                <button aria-label="Remove item" onClick={() => setItems(st.items.filter((x) => x.id !== it.id))} className="invisible ms-auto rounded p-0.5 text-foreground-icon-tertiary group-hover:visible">
                  <RiCloseLine className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
          {staff && (
            <li className="flex items-center gap-2 py-1">
              <RiAddLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
              <input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && item.trim() && (setItems([...st.items, { id: newId(), text: item.trim(), done: false }]), setItem(""))} placeholder="Add an item" aria-label="Add checklist item" className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary" />
            </li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-medium text-text-primary">Tasks</h3>
          {canEdit(p) && (
            <Button size="small" variant="ghost" leadingIcon={RiAddLine} onClick={() => newTask({ project_id: p.id, stage_id: st.id })}>
              Add task
            </Button>
          )}
        </div>
        {tasks.length ? (
          <ul className="flex flex-col">
            {tasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => navigate(withTask(t.id))} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-start hover:bg-background-secondary-default">
                  <StatusIcon status={t.status} />
                  <span className={cx("min-w-0 flex-1 truncate text-body-medium", t.status === "done" ? "text-text-tertiary line-through" : "text-text-primary")}>{t.title}</span>
                  {t.due && <span className="text-caption-1-medium text-text-tertiary">{relDay(t.due)}</span>}
                  <PersonAvatar person={personOf(s, t.assignee_id)} size="xs" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-regular text-text-tertiary">No tasks linked to this step.</p>
        )}
      </section>

      <Attachments s={s} stageId={st.id} projectId={p.id} editable={p.perm !== "view"} title="Documents" />

      <section className="flex flex-col gap-3">
        <h3 className="text-headline-medium text-text-primary">Discussion</h3>
        <Thread projectId={p.id} stageId={st.id} />
      </section>
    </section>
  );
}

function GateCard({ st, p, s, state }: { st: Stage; p: Project; s: Snapshot; state: StageState }) {
  const gate = GATES[st.gate!];
  const Icon = GATE_ICON[st.gate!];
  const staff = s.viewer.staff;
  const clientAdmin = !staff && (s.viewer.role === "owner" || s.viewer.role === "admin");
  const docs = s.files.filter((f) => f.stage_id === st.id && !f.internal);
  const signedDoc = s.files.find((f) => f.id === st.decided_file_id);
  const decider = personOf(s, st.decided_by);
  const asked = requestedAt(s, st);

  return (
    <div className={cx("flex flex-col gap-3 rounded-2xl border p-4", state === "waiting-client" ? "border-status-orange-text/40 bg-status-orange-background" : state === "changes" ? "border-status-rose-text/40 bg-status-rose-background" : st.decision === "approved" ? "border-status-lime-text/40 bg-status-lime-background" : "border-border-button-default bg-background-secondary-default")}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-primary-default">
          <Icon className="size-5 text-foreground-icon-secondary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-semibold text-text-primary">
            {st.decision === "approved"
              ? `${gate.label} given`
              : state === "waiting-client"
                ? clientAdmin
                  ? `This step needs your ${gate.label.toLowerCase()}`
                  : `Waiting on ${s.org.name}'s ${gate.label.toLowerCase()}`
                : state === "changes"
                  ? `${s.org.name} asked for changes`
                  : st.status === "active"
                    ? `${gate.label} comes next`
                    : `Ends with the client's ${gate.label.toLowerCase()}`}
          </p>
          <p className="mt-0.5 text-body-regular text-text-secondary">
            {st.decision === "approved" && decider
              ? `${decider.name} · ${new Date(st.decided_at!).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}${st.decided_ip ? ` · IP ${st.decided_ip}` : ""}`
              : state === "waiting-client"
                ? `Requested ${asked ? fmtDay(new Date(asked).toLocaleDateString("en-CA")) : ""}. Owners and admins at ${s.org.name} can sign off.`
                : state === "changes"
                  ? st.decision_note
                  : "StayonSite uploads the document, then asks for sign-off."}
          </p>
          {signedDoc && (
            <a href={fileUrl(signedDoc.id)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-body-medium text-text-primary underline">
              <RiFileTextLine className="size-4" aria-hidden />
              {signedDoc.name}
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {staff && st.status === "active" && st.decision !== "approved" && (
          <Button size="small" leadingIcon={RiSendPlane2Line} disabled={!docs.length && st.gate !== "go"} onClick={() => stageAction(st, "request")}>
            {state === "waiting-client" ? "Send reminder" : state === "changes" ? "Ask again" : `Request ${gate.label.toLowerCase()}`}
          </Button>
        )}
        {staff && st.status === "active" && !docs.length && st.gate !== "go" && <span className="self-center text-caption-1-medium text-text-tertiary">Upload the document below first.</span>}
        {clientAdmin && state === "waiting-client" && (
          <>
            <Button size="small" leadingIcon={Icon} onClick={() => decideModal(st, p, s, "approved")}>
              {gate.verb}
            </Button>
            <Button size="small" variant="secondary" onClick={() => decideModal(st, p, s, "rejected")}>
              Ask for changes
            </Button>
          </>
        )}
        {!staff && !clientAdmin && state === "waiting-client" && <span className="flex items-center gap-1.5 text-body-2-medium text-text-secondary"><RiTimeLine className="size-4" aria-hidden />Your owners or admins sign this off.</span>}
      </div>
    </div>
  );
}

function decideModal(st: Stage, p: Project, s: Snapshot, decision: "approved" | "rejected") {
  openModal((close) => <Decide st={st} p={p} s={s} decision={decision} close={close} />);
}

function Decide({ st, p, s, decision, close }: { st: Stage; p: Project; s: Snapshot; decision: "approved" | "rejected"; close: () => void }) {
  const gate = GATES[st.gate!];
  const docs = s.files.filter((f) => f.stage_id === st.id && !f.internal).sort((a, b) => b.created_at - a.created_at);
  const [fileId, setFileId] = useState(docs[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const me = personOf(s, s.viewer.id);
  const approve = decision === "approved";
  const submit = async () => {
    if (!approve && !note.trim()) return;
    setBusy(true);
    const r = await stageAction(st, "decide", { decision, note: note.trim() || undefined, file_id: fileId || undefined });
    setBusy(false);
    if (r) close();
  };
  return (
    <Sheet
      title={approve ? `${gate.verb}: ${st.name}` : `Ask for changes: ${st.name}`}
      subtitle={p.name}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || (!approve && !note.trim())} leadingIcon={approve ? RiCheckLine : undefined}>
            {approve ? `${gate.verb} as ${me?.name}` : "Send to StayonSite"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {docs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body-medium text-text-primary">Document</span>
            {docs.map((f) => (
              <label key={f.id} className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5", fileId === f.id ? "border-border-button-active" : "border-border-button-default")}>
                <input type="radio" name="doc" checked={fileId === f.id} onChange={() => setFileId(f.id)} className="accent-accent-500" />
                <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{f.name}</span>
                <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="text-body-2-medium text-text-secondary underline">
                  Open
                </a>
              </label>
            ))}
          </div>
        )}
        <Textarea label={approve ? "Note (optional)" : "What needs to change?"} value={note} onChange={setNote} rows={3} autoFocus={!approve} />
        {approve && (
          <p className="flex items-start gap-2 rounded-2xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
            <RiInformationLine className="mt-0.5 size-4 shrink-0" aria-hidden />
            By selecting {gate.verb}, you confirm you're authorised to do this for {s.org.name}. StayonSite records your name, the time, your IP address and the exact document. If your team needs a wet or e-signature, upload the signed PDF to this step as well.
          </p>
        )}
      </div>
    </Sheet>
  );
}
