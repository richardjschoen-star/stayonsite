import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  RiBookOpenLine,
  RiCustomerService2Line,
  RiDatabase2Line,
  RiDriveLine,
  RiEyeOffLine,
  RiFolder3Line,
  RiGlobalLine,
  RiShieldKeyholeLine,
  RiSlackLine,
  RiUserFollowLine,
} from "@remixicon/react";
import { ImportantAlertsCard } from "@/components/application/medical/important-alerts-card";
import { Chip } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { FileUpload, formatFileSize } from "@/components/base/file-upload/file-upload";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Notification } from "@/components/base/notification/notification";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Slider } from "@/components/base/slider/slider";
import { SocialButton } from "@/components/base/social-button/social-button";
import { SwitchCard } from "@/components/base/switch/switch-card";
import { Globe } from "./globe";
import { cx } from "@/utils/cx";

type Category = "agents" | "search" | "copilots" | "infra" | "safety";

const FILTERS: { id: "all" | Category; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "agents", label: "Agents" },
  { id: "search", label: "Search" },
  { id: "copilots", label: "Copilots" },
  { id: "infra", label: "Infrastructure" },
  { id: "safety", label: "Safety" },
];

/** A Bencho-style tile: the live demo on a tray, the plain-language promise under it. */
function Tile({ title, description, children, bare }: { title: string; description: string; children: ReactNode; bare?: boolean }) {
  return (
    <article className="spotlight reveal mb-4 break-inside-avoid rounded-3xl border border-border-button-default bg-background-primary-default p-2">
      {bare ? children : <div className="rounded-[18px] bg-background-secondary-default p-4">{children}</div>}
      <div className="flex flex-col gap-1 px-3 pt-4 pb-3">
        <h3 className="text-title-3-semibold text-text-primary">{title}</h3>
        <p className="text-body-regular text-text-secondary">{description}</p>
      </div>
    </article>
  );
}

/** Bencho's confetti, kept small: a ring of brand dots off the approval. */
function Burst() {
  return (
    <span aria-hidden className="burst pointer-events-none absolute top-1/2 left-1/2">
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = 56 + (i % 3) * 18;
        return (
          <span
            key={i}
            style={{ "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px` } as CSSProperties}
            className={cx("absolute size-1.5 rounded-full", i % 2 ? "bg-brand-yellow" : "bg-accent-500")}
          />
        );
      })}
    </span>
  );
}

function Approval() {
  const [state, setState] = useState<"pending" | "approved" | "declined">("pending");
  return (
    <div className="relative">
      <ApprovalCard state={state} setState={setState} />
      {state === "approved" && <Burst />}
    </div>
  );
}

function ApprovalCard({ state, setState }: { state: "pending" | "approved" | "declined"; setState: (s: "pending" | "approved" | "declined") => void }) {
  if (state === "pending")
    return (
      <Notification
        avatar={{ initials: "R", color: "blue" }}
        title="Refund agent"
        timestamp="now"
        description="Refund $640 on order #88213? The customer was charged twice on Oct 14."
        actions={[
          { label: "Decline", variant: "secondary", onClick: () => setState("declined") },
          { label: "Approve", variant: "primary", onClick: () => setState("approved") },
        ]}
      />
    );
  return (
    <Notification
      key={state}
      status={state === "approved" ? "success" : "neutral"}
      title={state === "approved" ? "Refund approved" : "Refund declined"}
      description={
        state === "approved"
          ? "The agent refunded $640 and replied to the customer. Logged under your name."
          : "The agent told the customer a specialist will follow up within a day."
      }
      actions={[{ label: "Undo", variant: "secondary", onClick: () => setState("pending") }]}
    />
  );
}

const SOURCES = [
  { id: "confluence", label: "Confluence", icon: RiBookOpenLine, docs: 12840 },
  { id: "drive", label: "Google Drive", icon: RiDriveLine, docs: 22310 },
  { id: "postgres", label: "Postgres", icon: RiDatabase2Line, docs: 4120 },
  { id: "slack", label: "Slack", icon: RiSlackLine, docs: 96400 },
  { id: "zendesk", label: "Zendesk", icon: RiCustomerService2Line, docs: 18204 },
  { id: "sharepoint", label: "SharePoint", icon: RiFolder3Line, docs: 7730 },
];

/** Connect-sources hub (Bencho) drawn as orbit rings (Reverse UI) around the mark. */
function Sources() {
  const [on, setOn] = useState(new Set(["confluence", "postgres", "zendesk"]));
  const toggle = (id: string) => setOn((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const pos = (i: number) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 38 };
  };
  const docs = SOURCES.filter((s) => on.has(s.id)).reduce((n, s) => n + s.docs, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-[280px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle cx="50" cy="50" r="38" fill="none" strokeWidth="0.3" strokeDasharray="1 1.5" className="stroke-separator-border-strong" />
          <circle cx="50" cy="50" r="20" fill="none" strokeWidth="0.3" className="stroke-separator-border" />
          {SOURCES.map((s, i) => {
            const p = pos(i);
            return (
              <line
                key={s.id}
                x1="50" y1="50" x2={p.x} y2={p.y}
                strokeWidth={on.has(s.id) ? 0.6 : 0.3}
                strokeDasharray={on.has(s.id) ? undefined : "1 1.2"}
                className={cx("transition-colors duration-150", on.has(s.id) ? "flow stroke-accent-500" : "stroke-separator-border-strong")}
              />
            );
          })}
        </svg>
        {/* The hub turns a petal for every source connected. */}
        <img
          src="/mark.png"
          alt=""
          style={{ rotate: `${on.size * 60}deg` }}
          className="absolute top-1/2 left-1/2 size-10 -translate-1/2 transition-[rotate] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
        />
        {SOURCES.map((s, i) => {
          const p = pos(i);
          return (
            <span
              key={`${s.id}-${on.has(s.id)}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={cx(
                "pop absolute flex size-10 -translate-1/2 items-center justify-center rounded-full border transition-colors duration-150",
                on.has(s.id)
                  ? "border-accent-500 bg-background-primary-default text-accent-400"
                  : "border-border-button-default bg-background-secondary-default text-foreground-icon-tertiary",
              )}
            >
              <s.icon className="size-5" aria-hidden />
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {SOURCES.map((s) => (
          <Checkbox key={s.id} size="sm" isSelected={on.has(s.id)} onChange={() => toggle(s.id)}>
            {s.label}
          </Checkbox>
        ))}
      </div>
      <p key={docs} className="number-fade text-body-2-medium text-text-secondary" aria-live="polite">
        {on.size === 0 ? "Connect a source to start indexing." : `${docs.toLocaleString("en-US")} documents searchable, with citations.`}
      </p>
    </div>
  );
}

function Upload() {
  const [done, setDone] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <FileUpload allowedExtensions={[".pdf", ".docx", ".md", ".txt"]} onUploadComplete={setDone} />
      <p className="text-body-2-medium text-text-secondary" aria-live="polite">
        {done
          ? `${done.name}: ${Math.max(1, Math.ceil(done.size / 2400))} chunks from ${formatFileSize(done.size)}, embedded on your cluster.`
          : "Try any PDF. In this demo the file never leaves your browser."}
      </p>
    </div>
  );
}

const MODELS = [
  { id: "qwen", label: "Qwen 3 32B", where: "On your GPUs", ms: 420, cost: 0.3 },
  { id: "llama", label: "Llama 4 Maverick", where: "On your GPUs", ms: 760, cost: 0.6 },
  { id: "gpt", label: "GPT-5 mini", where: "Azure, inside your tenant", ms: 980, cost: 1.4 },
  { id: "claude", label: "Claude Sonnet", where: "Bedrock, inside your AWS account", ms: 1240, cost: 3.1 },
];
const EFFORT = ["Minimal", "Low", "Medium", "High", "Maximum"];

function Models() {
  const [model, setModel] = useState("llama");
  const [effort, setEffort] = useState(3);
  const m = MODELS.find((x) => x.id === model)!;
  return (
    <div className="flex flex-col gap-5">
      <RadioGroup aria-label="Model" value={model} onChange={setModel} className="gap-3">
        {MODELS.map((x) => (
          <Radio key={x.id} value={x.id} size="sm">
            <span className="text-body-medium text-text-primary">{x.label}</span>
            <span className="ms-1.5 text-body-regular text-text-tertiary">{x.where}</span>
          </Radio>
        ))}
      </RadioGroup>
      <Slider label="Reasoning effort" minValue={1} maxValue={5} value={effort} onChange={setEffort} formatValue={(v) => EFFORT[v - 1]} />
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["p95 latency", `${Math.round(m.ms * (0.55 + 0.3 * effort)).toLocaleString("en-US")} ms`],
          ["Per 1,000 answers", `$${(m.cost * (0.4 + 0.4 * effort)).toFixed(2)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-background-primary-default p-3">
            <dt className="text-caption-1-medium text-text-tertiary">{k}</dt>
            <dd key={v} className="number-fade text-title-3-semibold text-text-primary tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const CONTEXT = {
  naive: [
    { label: "Whole documents", k: 168, tone: "bg-chart-2" },
    { label: "Conversation", k: 24, tone: "bg-chart-1" },
    { label: "Tools", k: 4, tone: "bg-chart-3" },
    { label: "System prompt", k: 2, tone: "bg-chart-5" },
  ],
  engineered: [
    { label: "Retrieved passages", k: 18, tone: "bg-chart-2" },
    { label: "Conversation summary", k: 10, tone: "bg-chart-1" },
    { label: "Tools", k: 6, tone: "bg-chart-3" },
    { label: "System prompt", k: 3, tone: "bg-chart-5" },
    { label: "Memory", k: 2, tone: "bg-chart-4" },
  ],
};

/** Bencho's context-window find: one dot per 1K tokens of a 200K window. */
function Context() {
  const [mode, setMode] = useState<keyof typeof CONTEXT>("engineered");
  const [hover, setHover] = useState<string | null>(null);
  const rows = CONTEXT[mode];
  const used = rows.reduce((n, r) => n + r.k, 0);
  const dots = rows.flatMap((r) => Array.from({ length: r.k }, () => r));

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Prompt strategy"
        selectedKeys={[mode]}
        onSelectionChange={(keys) => keys.size && setMode([...keys][0] as keyof typeof CONTEXT)}
      >
        <SegmentedControlItem id="naive">Paste everything</SegmentedControlItem>
        <SegmentedControlItem id="engineered">Engineered</SegmentedControlItem>
      </SegmentedControl>
      <div className="flex items-baseline justify-between">
        <p key={used} className="number-fade text-title-1-medium text-text-primary tabular-nums">{used}K</p>
        <p className="text-body-2-medium text-text-tertiary">of 200K tokens, ${(used * 0.0021).toFixed(2)} per answer</p>
      </div>
      <div key={mode} className="grid grid-cols-[repeat(25,minmax(0,1fr))] gap-[3px]" aria-hidden>
        {Array.from({ length: 200 }, (_, i) => {
          const r = dots[i];
          return (
            <span
              key={i}
              style={{ "--i": i } as CSSProperties}
              className={cx(
                "cell-pop aspect-square rounded-full transition-opacity duration-150",
                r ? r.tone : "bg-background-tertiary-default",
                hover && r && r.label !== hover && "opacity-25",
              )}
            />
          );
        })}
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            key={r.label}
            onPointerEnter={() => setHover(r.label)}
            onPointerLeave={() => setHover(null)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-body-2-medium text-text-secondary transition-colors duration-150 hover:bg-background-primary-default"
          >
            <span className={cx("size-2 rounded-full", r.tone)} aria-hidden />
            <span className="flex-1">{r.label}</span>
            <span className="text-text-primary tabular-nums">{r.k}K</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REGIONS = [
  { id: "fra", label: "Frankfurt", detail: "AWS eu-central-1, your account", lat: 50.1, lon: 8.7, ms: 18 },
  { id: "muc", label: "Munich", detail: "On-prem, one rack of H100s", lat: 48.1, lon: 11.6, ms: 9 },
  { id: "iad", label: "Virginia", detail: "Azure East US, your tenant", lat: 38.9, lon: -77.4, ms: 41 },
  { id: "sin", label: "Singapore", detail: "Google Cloud asia-southeast1", lat: 1.35, lon: 103.8, ms: 36 },
  { id: "syd", label: "Sydney", detail: "On-prem, air-gapped", lat: -33.9, lon: 151.2, ms: 22 },
];

function Regions() {
  const [active, setActive] = useState("fra");
  const r = REGIONS.find((x) => x.id === active)!;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p key={r.detail} className="number-fade text-body-2-medium text-text-tertiary">{r.detail}</p>
          <p key={r.id} className="number-fade text-title-1-medium text-text-primary tabular-nums">{r.ms} ms</p>
        </div>
        <Chip variant="subtle" color="yellow">
          <RiGlobalLine className="me-1 size-3.5" aria-hidden />
          Data stays in region
        </Chip>
      </div>
      <Globe pins={REGIONS} active={active} className="mx-auto aspect-square w-full max-w-[260px] text-text-secondary" />
      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Deployment region">
        {REGIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === active}
            onClick={() => setActive(x.id)}
            className={cx(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-body-2-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              x.id === active ? "bg-background-primary-default text-text-primary" : "text-text-secondary hover:bg-background-primary-hover",
            )}
          >
            {x.id === active ? <StatusDot color="yellow" /> : <span className="mx-[3px] size-1.5 rounded-full bg-text-tertiary" aria-hidden />}
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const LOG = [
  "$ stayon deploy support-triage --target k8s://northwind-prod",
  "Built image support-triage:v15 in 38s",
  "Evals: returns 212/214, billing 118/120, tone 82/84",
  "Passed 412 of 418 cases (98.6%), threshold is 97%",
  "Canary at 10% in eu-central-1, error rate 0.02%",
  "Rolled out to 100%. Previous version kept for rollback",
  "Model traffic leaving the VPC: 0 B",
];

/** Reverse UI's retro terminal, replaying a real deploy when asked. */
function Deploy() {
  const [lines, setLines] = useState(1);
  const timer = useRef(0);
  const run = () => {
    window.clearInterval(timer.current);
    setLines(1);
    timer.current = window.setInterval(() => {
      setLines((n) => (n >= LOG.length ? (window.clearInterval(timer.current), n) : n + 1));
    }, 520);
  };
  return (
    <div className="flex flex-col gap-3">
      <pre className="min-h-[188px] overflow-x-auto rounded-xl bg-background-full p-4 font-mono text-caption-1-regular whitespace-pre-wrap text-text-secondary" aria-live="polite">
        {LOG.slice(0, lines).map((l, i) => (
          <div key={i} className={cx("enter", i === 0 ? "text-text-primary" : i === LOG.length - 1 && "text-brand-yellow")}>
            {i === 0 ? l : `✓ ${l}`}
          </div>
        ))}
        <span aria-hidden className="blink inline-block h-3.5 w-1.5 translate-y-0.5 bg-text-secondary" />
      </pre>
      <Button variant="secondary" size="small" className="self-start" onClick={run}>
        {lines > 1 ? "Deploy again" : "Run the deploy"}
      </Button>
    </div>
  );
}

function Guardrails() {
  return (
    <div className="flex flex-col gap-2">
      <SwitchCard icon={RiEyeOffLine} title="Redact personal data" description="Mask names, cards and IDs before the model sees them" defaultSelected />
      <SwitchCard icon={RiShieldKeyholeLine} title="Block prompt injection" description="Refuse instructions hidden in tickets and files" defaultSelected />
      <SwitchCard icon={RiUserFollowLine} title="Ask before refunds over $500" description="A person approves, the agent does the rest" defaultSelected />
      <SwitchCard icon={RiGlobalLine} title="Allow web browsing" description="Off by default for regulated teams" />
    </div>
  );
}

function Sso() {
  const [step, setStep] = useState<"pick" | "code" | "done">("pick");
  if (step === "pick")
    return (
      <div className="flex flex-col gap-2">
        <SocialButton brand="okta" fullWidth onClick={() => setStep("code")} />
        <SocialButton brand="microsoft" appearance="white" fullWidth onClick={() => setStep("code")} />
        <SocialButton brand="google" appearance="white" fullWidth onClick={() => setStep("code")} />
      </div>
    );
  if (step === "code")
    return (
      <div className="enter flex flex-col gap-3">
        <p className="text-body-medium text-text-primary">Enter the 6-digit code from your authenticator app</p>
        <InputOtp aria-label="Verification code" onComplete={() => setStep("done")} />
        <p className="text-body-2-medium text-text-tertiary">Any six digits work in this demo.</p>
      </div>
    );
  return (
    <div className="enter flex flex-col items-start gap-3">
      <Chip variant="subtle" color="blue">Signed in as Dana Okafor, support lead</Chip>
      <p className="text-body-regular text-text-secondary">
        This role can ask about tickets and orders. Payroll and HR documents are never retrieved for it.
      </p>
      <LinkButton variant="secondary" onClick={() => setStep("pick")}>Sign out</LinkButton>
    </div>
  );
}

const TILES: { cat: Category; title: string; description: string; demo: ReactNode; bare?: boolean }[] = [
  { cat: "agents", title: "Agents that ask before they act", description: "Support, finance and ops agents with real tools, memory and a person in the loop for anything risky.", demo: <Approval /> },
  { cat: "search", title: "Search across everything you own", description: "Retrieval over your wikis, drives, tickets and databases. Every answer links the page it came from.", demo: <Sources /> },
  { cat: "copilots", title: "The right model for each job", description: "Open models on your GPUs for the volume, frontier models in your own cloud account for the hard cases.", demo: <Models /> },
  { cat: "infra", title: "Deployed where your data lives", description: "Your AWS, Azure or Google Cloud account, your Kubernetes cluster, or a rack in your own building.", demo: <Regions /> },
  { cat: "copilots", title: "Context, on a budget", description: "We decide what the model reads, so answers stay sharp and the token bill stays flat.", demo: <Context /> },
  { cat: "safety", title: "Rules the agent cannot argue with", description: "Guardrails run outside the model, so a clever prompt cannot switch them off.", demo: <Guardrails /> },
  { cat: "search", title: "Your documents, embedded on your hardware", description: "Parsing, chunking and embeddings run in your network and land in your own Postgres.", demo: <Upload /> },
  { cat: "infra", title: "Shipped like the rest of your software", description: "Versioned prompts, eval gates in CI, canary rollouts and a rollback that takes one command.", demo: <Deploy /> },
  { cat: "safety", title: "Every block and override, on record", description: "A feed your security team can audit, export or pipe into the SIEM you already run.", demo: <ImportantAlertsCard className="h-[360px] rounded-[18px]" />, bare: true },
  { cat: "safety", title: "Behind your single sign-on", description: "Okta, Entra ID or Google Workspace, with roles that decide which documents an agent may read for whom.", demo: <Sso /> },
];

export function Capabilities() {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const tiles = TILES.filter((t) => filter === "all" || t.cat === filter);

  return (
    <section id="services" className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 py-28 sm:px-6">
      <div className="reveal flex flex-col items-center gap-4 text-center">
        <h2 className="max-w-[16ch] text-section-semibold font-stretch-semi-condensed text-balance text-text-primary">
          What we build, running on this page
        </h2>
        <p className="max-w-[56ch] text-headline-regular text-text-secondary">
          Every tile below is a working piece of a system we have shipped. Click, drag and toggle them.
        </p>
      </div>
      <div className="reveal -mx-4 flex overflow-x-auto px-4">
        <SegmentedControl
          className="mx-auto w-max"
          aria-label="Filter by service"
          variant="plain"
          selectedKeys={[filter]}
          onSelectionChange={(keys) => keys.size && setFilter([...keys][0] as typeof filter)}
        >
          {FILTERS.map((f) => (
            <SegmentedControlItem key={f.id} id={f.id}>{f.label}</SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {tiles.map((t) => (
          <Tile key={t.title} title={t.title} description={t.description} bare={t.bare}>
            {t.demo}
          </Tile>
        ))}
      </div>
    </section>
  );
}
