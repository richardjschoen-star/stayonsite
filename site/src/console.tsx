import { useEffect, useState } from "react";
import {
  RiAddLine,
  RiArrowUpLine,
  RiAttachment2,
  RiBookOpenLine,
  RiCheckboxCircleFill,
  RiCpuLine,
  RiDatabase2Line,
  RiFlaskLine,
  RiLockLine,
  RiPulseLine,
  RiRobot2Line,
  RiRouteLine,
  RiShieldCheckLine,
  RiTimerLine,
  RiUserVoiceLine,
} from "@remixicon/react";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { ComposerLoader } from "@/components/application/composer-loader/composer-loader";
import { DashboardSidebar, type DashboardNavItem } from "@/components/application/dashboard/dashboard-sidebar";
import { OrdersChartCard } from "@/components/application/dashboard/orders-chart-card";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { Badge } from "@/components/base/badges/badge";
import { Chip } from "@/components/base/badges/chip";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { Button } from "@/components/base/buttons/button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/buttons/button-group";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Notification } from "@/components/base/notification/notification";
import { Pagination } from "@/components/base/pagination/pagination";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { cx } from "@/utils/cx";

const NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", icon: RiPulseLine },
  { key: "agents", label: "Agents", icon: RiRobot2Line, badge: 6 },
  { key: "knowledge", label: "Knowledge", icon: RiBookOpenLine },
  { key: "evals", label: "Evaluations", icon: RiFlaskLine },
  { key: "models", label: "Models", icon: RiCpuLine },
  { key: "guardrails", label: "Guardrails", icon: RiShieldCheckLine },
  { key: "routing", label: "Routing", icon: RiRouteLine },
  { key: "voice", label: "Voice", icon: RiUserVoiceLine },
];

const STATS: Stat[] = [
  { icon: RiCheckboxCircleFill, label: "Tickets resolved", value: "18,204", delta: "+24%", deltaColor: "lime", tone: "blue" },
  { icon: RiTimerLine, label: "Median reply time", value: "41 s", delta: "-63%", deltaColor: "lime", tone: "sky" },
  { icon: RiUserVoiceLine, label: "Handed to a person", value: "6.2%", delta: "-1.8%", deltaColor: "lime", tone: "blue" },
  { icon: RiLockLine, label: "Data sent outside", value: "0 B", delta: "0%", deltaColor: "neutral", tone: "sky" },
];

const RESOLVED = [
  ["Jan", 6200, 0], ["Feb", 7100, 0], ["Mar", 8400, 0], ["Apr", 9800, 2100], ["May", 11200, 4300], ["Jun", 12100, 6900],
  ["Jul", 12900, 8800], ["Aug", 14200, 9900], ["Sep", 16300, 11800], ["Oct", 18204, 12600], ["Nov", 0, 13100], ["Dec", 0, 14000],
].map(([label, current, previous]) => ({ label: label as string, current: current as number, previous: previous as number }));

const STEPS = [
  { icon: RiDatabase2Line, label: "Searched 18,204 tickets in your Postgres", time: "0.4s" },
  { icon: RiBookOpenLine, label: "Read refund policy v7 from Confluence", time: "0.2s" },
  { icon: RiRouteLine, label: "Pulled 3 order histories from the Orders API", time: "1.1s" },
];

const RUNS = [
  { id: "r-9921", agent: "Support triage", status: "Resolved", color: "blue", region: "eu-central-1", time: "38 s" },
  { id: "r-9920", agent: "Refund review", status: "Waiting for approval", color: "yellow", region: "eu-central-1", time: "1 m 12 s" },
  { id: "r-9919", agent: "Contract search", status: "Resolved", color: "blue", region: "on-prem / munich", time: "4 s" },
  { id: "r-9918", agent: "Support triage", status: "Handed to a person", color: "neutral", region: "eu-central-1", time: "52 s" },
] as const;

/** Played once on load, then on demand. Reduced motion lands on the result. */
function useRun(onRunningChange: (running: boolean) => void) {
  const [step, setStep] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? STEPS.length + 1 : 0,
  );
  const running = step <= STEPS.length;

  useEffect(() => {
    onRunningChange(running);
    if (!running) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 1200 : 1100);
    return () => window.clearTimeout(id);
  }, [step, running, onRunningChange]);

  return { step, running, restart: () => setStep(0) };
}

function AgentRun({ onRunningChange }: { onRunningChange: (running: boolean) => void }) {
  const { step, running, restart } = useRun(onRunningChange);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      aria-label="Support triage agent, live run"
      className="flex flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-4">
        <div className="flex items-center gap-3">
          <img src="/mark.png" alt="" className={cx("size-6", running && "mark-spin")} />
          <div className="flex flex-col">
            <h3 className="text-body-medium text-text-primary">Support triage agent</h3>
            <p className="text-caption-1-medium text-text-tertiary">v14, Llama 3.3 70B on your GPUs</p>
          </div>
        </div>
        <Chip variant="subtle" color="blue">
          <RiLockLine className="me-1 size-3.5" aria-hidden />
          Runs inside your VPC
        </Chip>
      </header>

      <div className="flex min-h-[284px] flex-col gap-4 p-5" aria-live="polite">
        <p className="ms-auto max-w-[85%] rounded-2xl rounded-ee-md bg-background-secondary-default px-4 py-2.5 text-body-regular text-text-primary">
          Which escalations from this week need a refund decision? Draft replies for them.
        </p>

        <ol className="flex flex-col gap-2.5">
          {STEPS.slice(0, step).map(({ icon: Icon, label, time }) => (
            <li key={label} className="enter flex items-center gap-2.5 text-body-regular text-text-secondary">
              <Icon className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="text-caption-1-medium text-text-tertiary tabular-nums">{time}</span>
            </li>
          ))}
        </ol>

        {running && (
          <AgentThinking
            variant="wave"
            tone="primary"
            shimmer
            showTimer
            label={step < STEPS.length ? "Working" : "Drafting replies"}
          />
        )}

        {!running && (
          <div className="enter flex flex-col gap-3">
            <p className="text-body-regular text-text-primary">
              Three escalations need a decision. Orders #88213 and #88190 qualify for a full refund under policy v7. Order
              #87954 is outside the 30 day window, so I drafted a reply offering store credit instead.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="caption" color="soft">Policy v7, section 3</Chip>
              <Chip variant="caption" color="soft">Ticket #4821</Chip>
              <Chip variant="caption" color="soft">Order #87954</Chip>
              <Button variant="ghost" size="xs" className="ms-auto" onClick={restart}>
                Run again
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        <ComposerLoader active={running} colors={BRAND_LIGHT}>
          <form className="flex items-center gap-2 p-2" onSubmit={(e) => (e.preventDefault(), restart())}>
            <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownTrigger
                aria-label="Add context"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background-secondary-default transition-colors duration-150 hover:bg-background-secondary-hover"
              >
                <RiAddLine
                  className={cx("size-5 text-foreground-icon-secondary transition-transform duration-200", menuOpen && "rotate-45")}
                  aria-hidden
                />
              </DropdownTrigger>
              <DropdownPopover aria-label="Add context" className="w-72 p-2">
                <DropdownGroup label="Add">
                  {[
                    { icon: RiAttachment2, label: "Files from your drive" },
                    { icon: RiDatabase2Line, label: "A database table" },
                    { icon: RiBookOpenLine, label: "A Confluence space" },
                  ].map(({ icon: Icon, label }) => (
                    <DropdownItem key={label} onSelect={() => setMenuOpen(false)} className="px-2 py-1.5">
                      <Icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                      <span className="text-body-medium text-text-primary">{label}</span>
                    </DropdownItem>
                  ))}
                </DropdownGroup>
              </DropdownPopover>
            </Dropdown>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message the agent</span>
              <input
                className="w-full bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-placeholder"
                placeholder="Ask about tickets, orders or policies"
              />
            </label>
            <Button size="small" iconOnly leadingIcon={RiArrowUpLine} aria-label="Send" type="submit" />
          </form>
        </ComposerLoader>
      </div>
    </section>
  );
}

/** ComposerLoader blends hex triplets, so it takes the brand ramp as literals. */
const BRAND_LIGHT: [string, string, string, string] = ["#1f6bff", "#3392ff", "#ffe009", "#fff3a3"];

function RunsTable() {
  const [page, setPage] = useState(1);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-body-medium text-text-primary">Recent runs</h3>
        <Badge color="neutral">2,318 today</Badge>
      </div>
      <Table aria-label="Recent agent runs" size="sm">
        <TableHeader>
          <TableColumn id="run" isRowHeader>Run</TableColumn>
          <TableColumn id="agent">Agent</TableColumn>
          <TableColumn id="status">Status</TableColumn>
          <TableColumn id="region">Runs in</TableColumn>
          <TableColumn id="time">Took</TableColumn>
        </TableHeader>
        <TableBody>
          {RUNS.map((r) => (
            <TableRow key={r.id} id={r.id}>
              <TableCell><span className="tabular-nums">{r.id}</span></TableCell>
              <TableCell>{r.agent}</TableCell>
              <TableCell><Chip variant="subtle" color={r.color}>{r.status}</Chip></TableCell>
              <TableCell>{r.region}</TableCell>
              <TableCell><span className="tabular-nums">{r.time}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} totalPages={8} onChange={setPage} />
    </section>
  );
}

/**
 * The hero artwork: a working slice of the console we ship to clients, cut
 * from real BoardUI components and bled off both edges like boardui.com.
 */
export function Console({ onRunningChange }: { onRunningChange: (running: boolean) => void }) {
  const [range, setRange] = useState("30d");

  return (
    <div className="relative [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] max-lg:[mask-image:none]">
      <div className="mx-auto grid max-w-[1480px] items-start gap-4 px-4 lg:grid-cols-[248px_minmax(0,1fr)_340px]">
        <div className="hidden lg:block">
          <DashboardSidebar fluid showThemeToggle={false} items={NAV} selected="agents" />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <Breadcrumb aria-label="Console">
              <BreadcrumbItem href="#">Northwind Freight</BreadcrumbItem>
              <BreadcrumbItem href="#">Agents</BreadcrumbItem>
              <BreadcrumbItem current>Support triage</BreadcrumbItem>
            </Breadcrumb>
            <ButtonGroup aria-label="Time range" size="small" className="shrink-0">
              {["24h", "7d", "30d"].map((r) => (
                <ButtonGroupItem key={r} size="small" selected={range === r} onClick={() => setRange(r)}>
                  {r}
                </ButtonGroupItem>
              ))}
            </ButtonGroup>
          </div>
          <div className="hidden lg:block">
            <StatCards stats={STATS} />
          </div>
          <AgentRun onRunningChange={onRunningChange} />
          <div className="hidden lg:block">
            <RunsTable />
          </div>
        </div>

        <div className="hidden flex-col gap-4 lg:flex">
          <Notification
            status="success"
            title="support-triage v14 is live"
            timestamp="2 min ago"
            description="Passed 412 of 418 eval cases. Rolled out to eu-central-1 with no data leaving the VPC."
          />
          <OrdersChartCard title="Tickets resolved by agents" data={RESOLVED} className="flex-none" />
        </div>
      </div>
    </div>
  );
}
