import { Avatar } from "@/components/base/avatar/avatar";
import { CloseButton } from "@/components/base/buttons/close-button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { InputBase, TextField } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import {
  RiBriefcaseLine, RiBuilding2Line, RiCheckboxCircleFill, RiCodeSSlashLine, RiFile3Line,
  RiFileCodeLine, RiFileExcel2Line, RiFilePdf2Line, RiFileTextLine, RiFileWord2Line, RiFileZipLine,
  RiFlashlightLine, RiFocus3Line, RiFolderLine, RiGlobalLine, RiHeartLine, RiImageLine, RiLayoutGridLine,
  RiMegaphoneLine, RiPaletteLine, RiProgress2Line, RiProgress4Line, RiProgress6Line, RiRocketLine,
  RiShapesLine, RiSignalWifi1Line, RiSignalWifi2Line, RiSignalWifi3Line, RiSmartphoneLine, RiSparklingLine,
  RiStackLine, RiTeamLine, RiAlarmWarningFill, RiSubtractLine, RiCheckboxBlankCircleLine, RiSearchLine,
} from "@remixicon/react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { LABELS, PCOLORS, PRIOS, PSTAT } from "./constants";
import { linkClick } from "./router";
import { dismissToast, useStore } from "./store";
import type { Person, Project, LockedProject, Task } from "./types";

export type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false"; style?: CSSProperties }>;

/** Project / team icon names → Remix icons. */
export const ICONS: Record<string, IconType> = {
  globe: RiGlobalLine, smartphone: RiSmartphoneLine, megaphone: RiMegaphoneLine, rocket: RiRocketLine,
  component: RiShapesLine, building: RiBuilding2Line, layout: RiLayoutGridLine, palette: RiPaletteLine,
  code: RiCodeSSlashLine, briefcase: RiBriefcaseLine, target: RiFocus3Line, layers: RiStackLine,
  zap: RiFlashlightLine, heart: RiHeartLine, folder: RiFolderLine, sparkles: RiSparklingLine, users: RiTeamLine,
};

/** Project colours are data (like chart series), so they ride a CSS variable, not a palette class. */
export const tint = (color: string): CSSProperties => ({ "--c": PCOLORS[color as keyof typeof PCOLORS] ?? color }) as CSSProperties;

export function ProjectIcon({ p, size = "md", className }: { p: Pick<Project | LockedProject, "icon" | "color">; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = ICONS[p.icon] ?? RiFolderLine;
  return (
    <span
      style={tint(p.color)}
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-[color-mix(in_oklab,var(--c)_16%,transparent)] text-[var(--c)]",
        size === "sm" ? "size-4 rounded-sm" : size === "md" ? "size-5 rounded-md" : "size-9 rounded-xl",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : size === "md" ? "size-3.5" : "size-5"} aria-hidden />
    </span>
  );
}

const AVATAR_COLORS = ["blue", "lime", "pink", "neutral"] as const;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export function PersonAvatar({ person, size = "sm", className }: { person: Pick<Person, "id" | "name" | "image"> | undefined; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  if (!person) return <Avatar size={size} color="neutral" initials="?" className={className} />;
  return (
    <Avatar
      size={size}
      color={AVATAR_COLORS[Math.abs(hash(person.id)) % AVATAR_COLORS.length]}
      src={person.image ?? undefined}
      alt={person.name}
      initials={initials(person.name)}
      className={className}
      title={person.name}
    />
  );
}

/** Overlapping avatars with a +n tail. */
export function AvatarStack({ people, max = 4 }: { people: (Person | undefined)[]; max?: number }) {
  const shown = people.filter(Boolean).slice(0, max) as Person[];
  const extra = people.filter(Boolean).length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <PersonAvatar key={p.id} person={p} size="sm" className="ring-2 ring-background-primary-default" />
      ))}
      {extra > 0 && <Avatar size="sm" color="neutral" initials={`+${extra}`} className="ring-2 ring-background-primary-default" />}
    </span>
  );
}

const STATUS_ICON: Record<Task["status"], { icon: IconType; className: string }> = {
  backlog: { icon: RiCheckboxBlankCircleLine, className: "text-foreground-icon-quaternary" },
  todo: { icon: RiProgress2Line, className: "text-foreground-icon-tertiary" },
  progress: { icon: RiProgress4Line, className: "text-status-yellow-text" },
  review: { icon: RiProgress6Line, className: "text-status-blue-text" },
  done: { icon: RiCheckboxCircleFill, className: "text-status-lime-text" },
};
export function StatusIcon({ status, className }: { status: Task["status"]; className?: string }) {
  const { icon: Icon, className: tone } = STATUS_ICON[status];
  return <Icon className={cx("size-4 shrink-0", tone, className)} aria-hidden />;
}

const PRIO_ICON: Record<Task["priority"], { icon: IconType; className: string }> = {
  urgent: { icon: RiAlarmWarningFill, className: "text-status-orange-text" },
  high: { icon: RiSignalWifi3Line, className: "text-text-primary" },
  medium: { icon: RiSignalWifi2Line, className: "text-text-secondary" },
  low: { icon: RiSignalWifi1Line, className: "text-text-tertiary" },
  none: { icon: RiSubtractLine, className: "text-foreground-icon-quaternary" },
};
export function PriorityIcon({ priority, className }: { priority: Task["priority"]; className?: string }) {
  const { icon: Icon, className: tone } = PRIO_ICON[priority];
  return (
    <span title={PRIOS.find((p) => p.id === priority)?.name} className="inline-flex">
      <Icon className={cx("size-4 shrink-0", tone, className)} aria-hidden />
    </span>
  );
}

export function LabelChip({ id }: { id: string }) {
  const l = LABELS.find((x) => x.id === id);
  if (!l) return null;
  return (
    <span style={tint(l.c)} className="inline-flex items-center gap-1 rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary">
      <span className="size-1.5 rounded-full bg-[var(--c)]" />
      {l.name}
    </span>
  );
}

export function ProjectStatusChip({ status }: { status: Project["status"] }) {
  const s = PSTAT[status];
  return (
    <span style={tint(s.c)} className="inline-flex items-center gap-1.5 rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary">
      <span className="size-1.5 rounded-full bg-[var(--c)]" />
      {s.name}
    </span>
  );
}

/* --------------------------------------------------------------- dates --- */

const DAY = 864e5;
const parseDay = (d: string) => new Date(`${d}T00:00:00`);
export const dayDiff = (d: string) => Math.round((parseDay(d).getTime() - parseDay(new Date().toLocaleDateString("en-CA")).getTime()) / DAY);
export const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  parseDay(d).toLocaleDateString("en-US", { ...opts, ...(parseDay(d).getFullYear() !== new Date().getFullYear() && opts.month ? { year: "numeric" } : {}) });
export const isoDay = (date: Date) => date.toLocaleDateString("en-CA");
export const addDays = (d: string, n: number) => isoDay(new Date(parseDay(d).getTime() + n * DAY));

/** "Today", "Tomorrow", "Yesterday", or "Oct 24". */
export function relDay(d: string) {
  const n = dayDiff(d);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : fmtDay(d);
}

export function DueDate({ task, className }: { task: Pick<Task, "due" | "status">; className?: string }) {
  if (!task.due) return null;
  const n = dayDiff(task.due);
  const over = n < 0 && task.status !== "done";
  return (
    <span className={cx("whitespace-nowrap text-body-2-medium", over ? "text-text-error-primary" : n <= 1 && task.status !== "done" ? "text-status-orange-text" : "text-text-tertiary", className)}>
      {relDay(task.due)}
    </span>
  );
}

export function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;

export const fmtMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export function FileIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = type.startsWith("image/")
    ? RiImageLine
    : type === "application/pdf"
      ? RiFilePdf2Line
      : ["doc", "docx"].includes(ext)
        ? RiFileWord2Line
        : ["xls", "xlsx", "csv"].includes(ext)
          ? RiFileExcel2Line
          : ["zip", "gz", "tar"].includes(ext)
            ? RiFileZipLine
            : ["js", "ts", "json", "py", "sql", "yml", "yaml"].includes(ext)
              ? RiFileCodeLine
              : ["txt", "md"].includes(ext)
                ? RiFileTextLine
                : RiFile3Line;
  return <Icon className={cx("size-5 shrink-0 text-foreground-icon-secondary", className)} aria-hidden />;
}

/* -------------------------------------------------------------- layout --- */

export function Link({ href, className, children, title }: { href: string; className?: string; children: ReactNode; title?: string }) {
  return (
    <a href={href} onClick={linkClick} title={title} className={cx("outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring", className)}>
      {children}
    </a>
  );
}

/** Page title row; every page starts with one, on the shared gutter. */
export function PageHeader({ title, subtitle, icon, actions, children }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <h1 className="truncate text-title-2-medium text-text-primary">{title}</h1>
            {subtitle && <p className="mt-0.5 text-body-regular text-text-secondary">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx("flex min-w-0 flex-col rounded-3xl border border-border-button-default bg-background-primary-default dark:bg-background-secondary-default", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h2 className="text-headline-medium text-text-primary">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cx(padded && "px-5 pb-5", !title && padded && "pt-5")}>{children}</div>
    </section>
  );
}

export function Empty({ icon: Icon, title, body, action }: { icon?: IconType; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-background-tertiary-default">
          <Icon className="size-5 text-foreground-icon-secondary" aria-hidden />
        </span>
      )}
      <p className="text-headline-medium text-text-primary">{title}</p>
      {body && <p className="max-w-[44ch] text-body-regular text-text-secondary">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Server-sanitized HTML (descriptions, comments). */
export function Rich({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cx(
        "rich text-body-regular text-text-primary [&_a]:text-accent-500 [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border-button-default [&_blockquote]:ps-3 [&_blockquote]:text-text-secondary [&_code]:rounded [&_code]:bg-background-tertiary-default [&_code]:px-1 [&_h2]:text-headline-semibold [&_h3]:text-body-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background-tertiary-default [&_pre]:p-3 [&_span[data-mention]]:rounded [&_span[data-mention]]:bg-accent-500/15 [&_span[data-mention]]:px-0.5 [&_span[data-mention]]:text-accent-500 [&_ul]:list-disc",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="rise pointer-events-auto flex max-w-[min(520px,100%)] items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default py-2 ps-4 pe-2 shadow-dropdown"
        >
          <span className={cx("text-body-medium", t.tone === "error" ? "text-text-error-primary" : "text-text-primary")}>{t.text}</span>
          {t.action && (
            <LinkButton
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </LinkButton>
          )}
          <CloseButton size="2xs" aria-label="Dismiss" onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>
  );
}

/** A grey section label, as in gr8r's list group headers. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx("text-caption-1-semibold tracking-wide text-text-tertiary uppercase", className)}>{children}</p>
);

/** BoardUI's text field with a search glyph, for list and page filters. */
export function SearchField({ value, onChange, label, placeholder, autoFocus, className, size = "small" }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; autoFocus?: boolean; className?: string; size?: "small" | "medium" }) {
  return (
    <TextField aria-label={label} value={value} onChange={onChange} autoFocus={autoFocus} className={cx("w-full sm:w-56", className)}>
      <InputBase size={size} leadingIcon={RiSearchLine} placeholder={placeholder ?? label} />
    </TextField>
  );
}
