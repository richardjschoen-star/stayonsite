import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { cx } from "@/utils/cx";
import { parseDate } from "@internationalized/date";
import { RiCalendarLine, RiCheckLine, RiCloseLine, RiRepeat2Line, RiSearchLine, RiUserLine } from "@remixicon/react";
import { useRef, useState, type ReactNode } from "react";
import { LABELS, PRIOS, RECUR_DAYS, STATUSES } from "../constants";
import { openProjects, personOf, save, setTaskStatus, useSnap } from "../store";
import type { Person, Task } from "../types";
import { DueDate, LabelChip, PersonAvatar, PriorityIcon, ProjectIcon, StatusIcon, fmtDay, relDay } from "../ui";

export interface Option {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
}

/**
 * A menu that picks one value (or toggles several, with `multi`). Typing
 * filters long lists; number keys pick the nth row, like gr8r's status menu.
 */
export function Pick({
  options,
  value,
  onChange,
  children,
  label,
  multi = false,
  disabled = false,
  className,
  placement = "bottom start",
}: {
  options: Option[];
  value: string | string[] | null;
  onChange: (id: string) => void;
  children: ReactNode;
  label: string;
  multi?: boolean;
  disabled?: boolean;
  className?: string;
  placement?: "bottom start" | "bottom end" | "top start";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = (id: string) => (Array.isArray(value) ? value.includes(id) : value === id);
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const choose = (id: string) => {
    onChange(id);
    if (!multi) setOpen(false);
  };
  if (disabled) return <span className={cx("inline-flex items-center gap-1.5", className)}>{children}</span>;
  return (
    <Dropdown isOpen={open} onOpenChange={(o) => (setOpen(o), o || setQ(""))}>
      <DropdownTrigger
        aria-label={label}
        className={cx("inline-flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-start hover:bg-background-secondary-hover", className)}
      >
        {children}
      </DropdownTrigger>
      <DropdownPopover aria-label={label} placement={placement} className="w-60">
        <div
          onKeyDown={(e) => {
            const n = Number(e.key);
            if (!q && n >= 1 && n <= shown.length && !(e.target instanceof HTMLInputElement)) {
              e.preventDefault();
              choose(shown[n - 1].id);
            }
          }}
          className="flex flex-col gap-1"
        >
          {options.length > 6 && (
            <label className="mb-1 flex items-center gap-2 rounded-lg bg-background-tertiary-default px-2 py-1.5">
              <RiSearchLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && shown[0] && choose(shown[0].id)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="min-w-0 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-placeholder"
              />
            </label>
          )}
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {shown.map((o) => (
              <DropdownItem key={o.id} selected={selected(o.id)} onSelect={() => choose(o.id)} className="px-2 py-1.5">
                {o.icon}
                <span className="flex-1 truncate text-body-medium">{o.label}</span>
                {o.hint}
                {selected(o.id) && <RiCheckLine className="size-4 text-foreground-icon-secondary" aria-hidden />}
              </DropdownItem>
            ))}
            {shown.length === 0 && <p className="px-2 py-2 text-body-regular text-text-tertiary">No matches</p>}
          </div>
        </div>
      </DropdownPopover>
    </Dropdown>
  );
}

export const statusOptions: Option[] = STATUSES.map((s, i) => ({ id: s.id, label: s.name, icon: <StatusIcon status={s.id} />, hint: <span className="text-caption-1-medium text-text-tertiary">{i + 1}</span> }));
export const priorityOptions: Option[] = PRIOS.map((p) => ({ id: p.id, label: p.name, icon: <PriorityIcon priority={p.id} /> }));
export const labelOptions: Option[] = LABELS.map((l) => ({ id: l.id, label: l.name, icon: <LabelChip id={l.id} /> })).map((o) => ({ ...o, label: o.label }));

export function peopleOptions(people: Person[], none = "Unassigned"): Option[] {
  return [
    { id: "", label: none, icon: <RiUserLine className="size-5 text-foreground-icon-tertiary" aria-hidden /> },
    ...people.map((p) => ({ id: p.id, label: p.name, icon: <PersonAvatar person={p} size="xs" />, hint: p.staff ? <span className="text-caption-1-medium text-text-tertiary">StayonSite</span> : undefined })),
  ];
}

/* ------------------------------------------- task property pickers --- */

export function StatusPick({ task, disabled, showLabel = false }: { task: Task; disabled?: boolean; showLabel?: boolean }) {
  return (
    <Pick label="Status" options={statusOptions} value={task.status} disabled={disabled} onChange={(s) => setTaskStatus(task, s as Task["status"])}>
      <StatusIcon status={task.status} />
      {showLabel && <span className="truncate text-body-medium text-text-primary">{STATUSES.find((s) => s.id === task.status)?.name}</span>}
    </Pick>
  );
}

export function PriorityPick({ task, disabled, showLabel = false }: { task: Task; disabled?: boolean; showLabel?: boolean }) {
  return (
    <Pick label="Priority" options={priorityOptions} value={task.priority} disabled={disabled} onChange={(p) => save("task", task.id, { priority: p as Task["priority"] })}>
      <PriorityIcon priority={task.priority} />
      {showLabel && <span className="truncate text-body-medium text-text-primary">{PRIOS.find((p) => p.id === task.priority)?.name}</span>}
    </Pick>
  );
}

export function AssigneePick({ task, disabled, showLabel = false }: { task: Task; disabled?: boolean; showLabel?: boolean }) {
  const s = useSnap();
  const who = personOf(s, task.assignee_id);
  return (
    <Pick label="Assignee" options={peopleOptions(s.people)} value={task.assignee_id ?? ""} disabled={disabled} onChange={(id) => save("task", task.id, { assignee_id: id || null })}>
      {who ? <PersonAvatar person={who} size="xs" /> : <RiUserLine className="size-4 text-foreground-icon-quaternary" aria-hidden />}
      {showLabel && <span className={cx("truncate text-body-medium", who ? "text-text-primary" : "text-text-tertiary")}>{who?.name ?? "Unassigned"}</span>}
    </Pick>
  );
}

export function LabelsPick({ task, disabled }: { task: Task; disabled?: boolean }) {
  return (
    <Pick
      label="Labels"
      multi
      options={LABELS.map((l) => ({ id: l.id, label: l.name, icon: <span className="size-2 rounded-full" style={{ background: l.c }} /> }))}
      value={task.labels}
      disabled={disabled}
      onChange={(id) => save("task", task.id, { labels: task.labels.includes(id) ? task.labels.filter((x) => x !== id) : [...task.labels, id] })}
    >
      {task.labels.length ? (
        <span className="flex flex-wrap gap-1">{task.labels.map((l) => <LabelChip key={l} id={l} />)}</span>
      ) : (
        <span className="text-body-medium text-text-tertiary">Add labels</span>
      )}
    </Pick>
  );
}

export function ProjectPick({ task, disabled }: { task: Task; disabled?: boolean }) {
  const s = useSnap();
  const projects = openProjects(s).filter((p) => p.perm === "edit" || p.perm === "full");
  const p = s.projects.find((x) => x.id === task.project_id);
  return (
    <Pick
      label="Project"
      options={projects.map((x) => ({ id: x.id, label: x.name, icon: <ProjectIcon p={x} size="sm" /> }))}
      value={task.project_id}
      disabled={disabled}
      onChange={(id) => id !== task.project_id && save("task", task.id, { project_id: id, stage_id: null })}
    >
      {p && <ProjectIcon p={p} size="sm" />}
      <span className="truncate text-body-medium text-text-primary">{p?.name}</span>
    </Pick>
  );
}

export function RecurPick({ task, disabled }: { task: Task; disabled?: boolean }) {
  return (
    <Pick
      label="Repeat"
      options={[{ id: "", label: "Does not repeat" }, ...Object.keys(RECUR_DAYS).map((r) => ({ id: r, label: r }))]}
      value={task.recur ?? ""}
      disabled={disabled}
      onChange={(r) => save("task", task.id, { recur: r || null })}
    >
      <RiRepeat2Line className="size-4 text-foreground-icon-tertiary" aria-hidden />
      <span className={cx("text-body-medium", task.recur ? "text-text-primary" : "text-text-tertiary")}>{task.recur ?? "Does not repeat"}</span>
    </Pick>
  );
}

/** A date chip that opens BoardUI's DatePicker; empty shows the placeholder. */
export function DatePick({ value, onChange, placeholder = "Set date", disabled, task, label = "Date", className }: { value: string | null; onChange: (d: string | null) => void; placeholder?: string; disabled?: boolean; task?: Task; label?: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const body = task ? (
    task.due ? <DueDate task={task} /> : <span className="text-body-medium text-text-tertiary">{placeholder}</span>
  ) : value ? (
    <span className="text-body-medium text-text-primary">{relDay(value)}</span>
  ) : (
    <span className="text-body-medium text-text-tertiary">{placeholder}</span>
  );
  if (disabled) return <span className={cx("inline-flex items-center gap-1.5", className)}>{body}</span>;
  return (
    <span className="group/date inline-flex items-center">
      <button
        ref={ref}
        type="button"
        aria-label={value ? `${label}: ${fmtDay(value)}` : label}
        onClick={() => setOpen(!open)}
        className={cx("inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring", className)}
      >
        <RiCalendarLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
        {body}
      </button>
      {value && (
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(null)} className="invisible rounded p-0.5 text-foreground-icon-tertiary group-hover/date:visible hover:text-text-primary">
          <RiCloseLine className="size-3.5" aria-hidden />
        </button>
      )}
      <DatePicker
        aria-label={label}
        triggerRef={ref}
        isOpen={open}
        onOpenChange={setOpen}
        value={value ? parseDate(value) : null}
        onChange={(d) => onChange(d ? d.toString() : null)}
      />
    </span>
  );
}

export { DropdownDivider };
