import { OrdersChartCard } from "@/components/application/dashboard/orders-chart-card";
import { RevenueChartCard } from "@/components/application/dashboard/revenue-chart-card";
import {
  StatCards,
  type Stat,
} from "@/components/application/dashboard/stat-cards";
import {
  DataGrid,
  type DataGridColumn,
} from "@/components/application/data-grid/data-grid";
import {
  NotificationCenter,
  type NotificationCenterItem,
} from "@/components/application/notification-center/notification-center";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Carousel, CarouselItem } from "@/components/base/carousel/carousel";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { MeetingScheduler } from "@/components/base/date-picker/meeting-scheduler";
import { Input } from "@/components/base/input/input";
import { Notification } from "@/components/base/notification/notification";
import { RadioGroup } from "@/components/base/radio/radio";
import { RadioCard } from "@/components/base/radio/radio-card";
import { Select, SelectItem } from "@/components/base/select/select";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { Textarea } from "@/components/base/textarea/textarea";
import { TreeView, TreeViewItem } from "@/components/base/tree-view/tree-view";
import { cx } from "@/utils/cx";
import { STEPS } from "./process";
import {
  RiAddLine,
  RiArrowRightLine,
  RiCheckLine,
  RiFlaskLine,
  RiMoneyDollarCircleLine,
  RiSpeedUpLine,
  RiTimerLine,
} from "@remixicon/react";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

function SectionHead({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="reveal flex flex-col items-center gap-4 text-center">
      <h2 className="max-w-[18ch] text-section-semibold font-stretch-semi-condensed text-balance text-text-primary">
        {title}
      </h2>
      <p className="max-w-[56ch] text-headline-regular text-text-secondary">
        {children}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Work --- */

const SAVED = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
].map((label, i) => ({
  label,
  current: 61000 + i * 8400,
  previous: 22000 + i * 3100,
}));

const CONTRACTS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
].map((label, i) => ({
  label,
  current: 1400 + i * 190,
  previous: 900 + i * 40,
}));

const WORK: {
  client: string;
  title: string;
  date: string;
  results: string[];
  thumb: ReactNode;
}[] = [
  {
    client: "Northwind Freight",
    title: "Support triage agent in their AWS account",
    date: "Oct 2026",
    results: [
      "71% of tickets resolved without a person",
      "$1.4M lower support cost per year",
    ],
    thumb: <RevenueChartCard title="Support cost saved" data={SAVED} />,
  },
  {
    client: "Halden Health",
    title: "Clinical guideline search, fully on-prem",
    date: "Aug 2026",
    results: [
      "Answers in 4 seconds, not 20 minutes",
      "No patient data in any public cloud",
    ],
    thumb: (
      <div className="rounded-2xl bg-background-secondary-default p-3">
        <TreeView
          aria-label="Indexed guidelines"
          defaultExpandedKeys={["cardio", "peds"]}
          defaultSelectedKeys={["af"]}
        >
          <TreeViewItem id="cardio" label="Cardiology">
            <TreeViewItem
              id="af"
              label="Atrial fibrillation 2026.pdf"
              iconClassName="text-accent-500"
            />
            <TreeViewItem
              id="hf"
              label="Heart failure pathway.pdf"
              iconClassName="text-accent-500"
            />
          </TreeViewItem>
          <TreeViewItem id="peds" label="Paediatrics">
            <TreeViewItem
              id="fever"
              label="Fever under 5s.docx"
              iconClassName="text-brand-yellow"
            />
            <TreeViewItem
              id="asthma"
              label="Acute asthma.pdf"
              iconClassName="text-accent-500"
            />
          </TreeViewItem>
          <TreeViewItem id="pharm" label="Formulary" />
        </TreeView>
      </div>
    ),
  },
  {
    client: "Kestrel Bank",
    title: "Contract review copilot for the legal team",
    date: "Jun 2026",
    results: [
      "3,200 contracts reviewed a month",
      "96% recall on risky clauses",
    ],
    thumb: <OrdersChartCard title="Contracts reviewed" data={CONTRACTS} />,
  },
  {
    client: "Atlas Outdoor",
    title: "Catalog enrichment pipeline in German and French",
    date: "Mar 2026",
    results: ["212,000 product pages rewritten", "Organic traffic up 38%"],
    thumb: (
      <div className="flex flex-col gap-2">
        <div className="rounded-2xl bg-background-secondary-default p-4">
          <p className="text-caption-1-medium text-text-tertiary">Before</p>
          <p className="text-body-regular text-text-secondary">
            Jacket, blue, size M, waterproof.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-500 bg-background-primary-default p-4">
          <p className="text-caption-1-medium text-accent-400">
            After, checked by the brand team
          </p>
          <p className="text-body-regular text-text-primary">
            Wasserdichte Hardshell-Jacke mit 20.000 mm Wassersäule, verklebten
            Nähten und Unterarm-Belüftung.
          </p>
        </div>
      </div>
    ),
  },
];

/** Reverse UI's component card: artwork, name and date on it, an action bar under it. */
export function Work() {
  return (
    <section id="work" className="flex flex-col gap-12 py-28">
      <div className="px-4">
        <SectionHead title="Shipped, measured, still running">
          A few systems from the last year. Each one runs inside the client's
          own infrastructure today.
        </SectionHead>
      </div>
      <div className="reveal mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <Carousel aria-label="Case studies" gap={16}>
          {WORK.map((w) => (
            <CarouselItem key={w.client} className="w-[min(380px,85vw)]">
              <article className="spotlight group flex h-full flex-col rounded-3xl border border-border-button-default bg-background-secondary-default p-1.5">
                <div className="relative h-[340px] overflow-hidden rounded-[20px] bg-background-primary-default p-3">
                  <div
                    className="pointer-events-none origin-top transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] select-none group-hover:scale-[1.03] motion-reduce:transition-none [&_*]:pointer-events-none"
                    inert
                  >
                    {w.thumb}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-background-primary-default from-40% to-transparent px-4 pt-16 pb-3">
                    <span className="text-body-medium text-text-primary">
                      {w.client}
                    </span>
                    <span className="text-body-2-medium text-text-tertiary">
                      {w.date}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 px-3 pt-4 pb-2">
                  <h3 className="text-title-3-semibold text-text-primary">
                    {w.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {w.results.map((r) => (
                      <Chip key={r} variant="caption" color="soft">
                        {r}
                      </Chip>
                    ))}
                  </div>
                  <LinkButton
                    href="#contact"
                    trailingIcon={RiArrowRightLine}
                    className="nudge mt-auto self-start pt-2"
                  >
                    Ask about this project
                  </LinkButton>
                </div>
              </article>
            </CarouselItem>
          ))}
        </Carousel>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Process --- */

type EvalRow = {
  id: string;
  set: string;
  cases: number;
  passed: number;
  p95: number;
};

const EVAL_COLUMNS: DataGridColumn<EvalRow>[] = [
  { key: "set", header: "Test set", width: 180, editable: false },
  {
    key: "cases",
    header: "Cases",
    type: "number",
    min: 0,
    summary: "sum",
    align: "end",
    width: 96,
  },
  {
    key: "passed",
    header: "Passed",
    type: "number",
    min: 0,
    summary: "sum",
    align: "end",
    width: 96,
  },
  {
    key: "p95",
    header: "p95 ms",
    type: "number",
    min: 0,
    summary: "average",
    align: "end",
    width: 96,
    formatSummary: (v) => Math.round(v),
  },
];

const FEEDBACK: NotificationCenterItem[] = [
  {
    id: "f1",
    category: "mentions",
    group: "Pilot week 2",
    title: "Dana mentioned the agent",
    description:
      "The draft for #4821 was better than what I would have written. Sent as is.",
    timestamp: "2h",
    unread: true,
    avatar: { initials: "D", color: "blue" },
  },
  {
    id: "f2",
    category: "mentions",
    group: "Pilot week 2",
    title: "Jonas flagged an answer",
    description:
      "It quoted the 2024 returns policy. Added to the eval set as case 219.",
    timestamp: "5h",
    unread: true,
    avatar: { initials: "J", color: "neutral" },
  },
  {
    id: "f3",
    category: "system",
    group: "Pilot week 2",
    title: "Eval suite grew to 418 cases",
    description: "31 new cases came from pilot feedback this week.",
    timestamp: "1d",
    status: "success",
  },
  {
    id: "f4",
    category: "system",
    group: "Pilot week 1",
    title: "Pilot opened to 5 agents",
    description: "Read-only mode. Every reply is reviewed before sending.",
    timestamp: "6d",
    status: "information",
  },
];

const REPORT: Stat[] = [
  {
    icon: RiFlaskLine,
    label: "Eval pass rate",
    value: "98.6%",
    delta: "+0.9%",
    deltaColor: "lime",
    tone: "blue",
    caption: "vs. last month",
  },
  {
    icon: RiMoneyDollarCircleLine,
    label: "Cost per answer",
    value: "$0.031",
    delta: "-22%",
    deltaColor: "lime",
    tone: "sky",
    caption: "after the model upgrade",
  },
  {
    icon: RiSpeedUpLine,
    label: "Uptime",
    value: "99.97%",
    delta: "0%",
    deltaColor: "neutral",
    tone: "blue",
    caption: "two planned windows",
  },
];

export function Process() {
  const [step, setStep] = useState("discover");
  const [evals, setEvals] = useState<EvalRow[]>([
    {
      id: "returns",
      set: "Returns and refunds",
      cases: 214,
      passed: 212,
      p95: 1840,
    },
    {
      id: "billing",
      set: "Billing questions",
      cases: 120,
      passed: 118,
      p95: 1320,
    },
    { id: "tone", set: "Tone and empathy", cases: 84, passed: 82, p95: 960 },
  ]);
  const index = STEPS.findIndex((s) => s.id === step);
  const passRate =
    (evals.reduce((n, r) => n + r.passed, 0) /
      Math.max(
        1,
        evals.reduce((n, r) => n + r.cases, 0),
      )) *
    100;

  const artifacts: Record<string, ReactNode> = {
    discover: (
      <div className="rounded-2xl bg-background-secondary-default p-3">
        <TreeView
          aria-label="Discovery pack"
          defaultExpandedKeys={["pack", "data"]}
          defaultSelectedKeys={["shortlist"]}
        >
          <TreeViewItem id="pack" label="discovery-pack">
            <TreeViewItem
              id="shortlist"
              label="workflow-shortlist.pdf"
              iconClassName="text-accent-500"
            />
            <TreeViewItem
              id="arch"
              label="architecture.excalidraw"
              iconClassName="text-brand-yellow"
            />
            <TreeViewItem id="data" label="data-review">
              <TreeViewItem
                id="zendesk"
                label="zendesk-sample.parquet"
                iconClassName="text-accent-500"
              />
              <TreeViewItem id="gaps" label="gaps-and-risks.md" />
            </TreeViewItem>
            <TreeViewItem
              id="quote"
              label="fixed-quote.pdf"
              iconClassName="text-accent-500"
            />
          </TreeViewItem>
        </TreeView>
      </div>
    ),
    prototype: (
      <NotificationCenter notifications={FEEDBACK} className="max-w-none" />
    ),
    production: (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-2-medium text-text-secondary">
            Edit a cell. The release gate is 97%.
          </p>
          <Chip
            key={passRate >= 97 ? "ships" : "blocked"}
            variant="subtle"
            color={passRate >= 97 ? "blue" : "rose"}
            className="pop"
          >
            {passRate.toFixed(1)}% {passRate >= 97 ? "ships" : "blocked"}
          </Chip>
        </div>
        <DataGrid
          aria-label="Eval suite"
          data={evals}
          columns={EVAL_COLUMNS}
          getRowId={(r) => r.id}
          onDataChange={setEvals}
          height={236}
          exportFileName="evals.csv"
        />
      </div>
    ),
    operate: <StatCards variant="footer" stats={REPORT} columns={2} />,
  };

  return (
    <section
      id="process"
      className="mx-auto flex max-w-[1240px] flex-col gap-12 px-4 py-28 sm:px-6"
    >
      <SectionHead title="From first call to running in production">
        Four phases, each with a fixed price and something you can use at the
        end of it. You can stop after any of them.
      </SectionHead>

      <Tabs
        selectedKey={step}
        onSelectionChange={(k) => setStep(String(k))}
        className="reveal flex flex-col gap-8"
      >
        <div className="flex flex-col gap-3">
          {/* Reverse UI's timeline progress: filled up to the phase on screen. */}
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className="h-1 overflow-hidden rounded-full bg-background-tertiary-default"
              >
                <span
                  className={cx(
                    "block h-full origin-left rounded-full bg-brand-yellow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none rtl:origin-right",
                    i <= index ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
            ))}
          </div>
          <TabList aria-label="Project phases" className="overflow-x-auto">
            {STEPS.map((s, i) => (
              <Tab key={s.id} id={s.id}>{`${i + 1}. ${s.name}`}</Tab>
            ))}
          </TabList>
        </div>
        {STEPS.map((s) => (
          <TabPanel
            key={s.id}
            id={s.id}
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          >
            <div className="enter flex flex-col gap-5">
              <Chip variant="subtle" color="yellow" className="self-start">
                <RiTimerLine className="me-1 size-3.5" aria-hidden />
                {s.length}
              </Chip>
              <p className="text-title-2-regular text-text-primary">{s.body}</p>
              <ul className="flex flex-col gap-2.5">
                {s.gets.map((g) => (
                  <li
                    key={g}
                    className="flex items-center gap-2.5 text-body-regular text-text-secondary"
                  >
                    <RiCheckLine
                      className="size-4 shrink-0 text-accent-500"
                      aria-hidden
                    />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div className="enter rounded-3xl border border-border-button-default bg-background-primary-default p-3">
              {artifacts[s.id]}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </section>
  );
}

// Pricing is paused. Uncomment this block and the <Pricing /> line in App.tsx to bring it back.
// /* ------------------------------------------------------------- Pricing --- */
//
// const PLANS = [
//   {
//     name: "Discovery sprint",
//     price: "$14,000",
//     unit: "fixed, two weeks",
//     body: "Find out whether AI pays off for one workflow, with a prototype to prove it.",
//     cta: "Book a discovery call",
//     features: [
//       "Workflow and data review",
//       "Prototype on your real data",
//       "Architecture for your environment",
//       "Fixed quote for the build",
//     ],
//   },
//   {
//     name: "Build",
//     price: "From $60,000",
//     unit: "per project, 6 to 10 weeks",
//     body: "One production system, deployed in your cloud or data center and handed over.",
//     cta: "Plan a build",
//     features: [
//       "Agent, copilot or search",
//       "Eval suite and guardrails",
//       "SSO, logging and monitoring",
//       "Handover docs and training",
//     ],
//   },
//   {
//     name: "Embedded team",
//     price: "$22,000",
//     unit: "per month",
//     body: "Two engineers and a designer working as part of your team, shipping every month.",
//     cta: "Talk to us",
//     features: [
//       "Monthly releases",
//       "Model upgrades and cost reviews",
//       "On-call for production",
//       "Cancel with 30 days notice",
//     ],
//   },
// ];
//
// const PROMISES = [
//   {
//     icon: RiCodeSSlashLine,
//     label: "You own the code and weights",
//     hint: "Repositories, prompts, eval sets and fine-tuned weights live in your accounts from day one.",
//   },
//   {
//     icon: RiLockLine,
//     label: "Runs in your environment",
//     hint: "Your cloud account, your cluster or your data center. We never host your data.",
//   },
//   {
//     icon: RiFileShieldLine,
//     label: "NDA before the first call",
//     hint: "Ask in the form below and we send our mutual NDA before we talk.",
//   },
// ];
//
// export function Pricing() {
//   return (
//     <section
//       id="pricing"
//       className="mx-auto flex max-w-[1240px] flex-col gap-12 px-4 py-28 sm:px-6"
//     >
//       <SectionHead title="Priced per phase, not per hour">
//         Every phase ends with something that works. If the numbers are not
//         there, you stop and keep everything we built.
//       </SectionHead>
//       <div className="grid gap-4 lg:grid-cols-3">
//         {PLANS.map((p) => (
//           <article
//             key={p.name}
//             className="flex flex-col gap-6 rounded-3xl border border-border-button-default bg-background-primary-default p-6"
//           >
//             <div className="flex flex-col gap-2">
//               <h3 className="text-title-3-semibold text-text-primary">
//                 {p.name}
//               </h3>
//               <p className="text-body-regular text-text-secondary">{p.body}</p>
//             </div>
//             <div className="flex flex-col">
//               <p className="text-display-4-semibold font-stretch-semi-condensed text-text-primary">
//                 {p.price}
//               </p>
//               <p className="text-body-2-medium text-text-tertiary">{p.unit}</p>
//             </div>
//             <ButtonLink
//               href="#contact"
//               variant={p.name === "Build" ? "primary" : "secondary"}
//               className="w-full"
//             >
//               {p.cta}
//             </ButtonLink>
//             <ul className="flex flex-col gap-2.5 border-t border-separator-border pt-5">
//               {p.features.map((f) => (
//                 <li
//                   key={f}
//                   className="flex items-center gap-2.5 text-body-regular text-text-secondary"
//                 >
//                   <RiCheckLine
//                     className="size-4 shrink-0 text-accent-500"
//                     aria-hidden
//                   />
//                   {f}
//                 </li>
//               ))}
//             </ul>
//           </article>
//         ))}
//       </div>
//       <Divider>Included in every engagement</Divider>
//       <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
//         {PROMISES.map(({ icon: Icon, label, hint }) => (
//           <li key={label}>
//             <TooltipTrigger delay={0}>
//               <Focusable>
//                 <button
//                   type="button"
//                   className="flex cursor-default items-center gap-2 rounded-md text-body-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
//                 >
//                   <Icon
//                     className="size-5 text-foreground-icon-secondary"
//                     aria-hidden
//                   />
//                   {label}
//                 </button>
//               </Focusable>
//               <Tooltip>{hint}</Tooltip>
//             </TooltipTrigger>
//           </li>
//         ))}
//       </ul>
//     </section>
//   );
// }
//

/* --------------------------------------------------------- Testimonial --- */

const QUOTE_WORDS =
  "We expected a chatbot. We got a support agent our auditors signed off on, running in our own AWS account. It closes seven in ten tickets and no customer data went to anyone.".split(" ");

export function Testimonial() {
  return (
    <section className="mx-auto flex max-w-[960px] flex-col items-center gap-8 px-4 py-20 text-center sm:px-6">
      <img src="/mark.png" alt="" className="scroll-spin size-8" />
      {/* Words fill in as the quote scrolls through the viewport. */}
      <blockquote className="scrub-words text-display-4-medium font-stretch-semi-condensed text-balance text-text-primary">
        {QUOTE_WORDS.map((w, i) => {
          const at = 12 + (i / QUOTE_WORDS.length) * 34;
          return (
            <span key={i} style={{ "--s": `${at}%`, "--e": `${at + 8}%` } as CSSProperties}>
              {`${w} `}
            </span>
          );
        })}
      </blockquote>
      <div className="reveal flex items-center gap-3 text-start">
        <Avatar size="lg" color="blue" initials="ML" />
        <div>
          <p className="text-body-medium text-text-primary">Mara Lindqvist</p>
          <p className="text-body-regular text-text-secondary">
            VP Customer Operations, Northwind Freight
          </p>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- FAQ --- */

const FAQ = [
  [
    "Does any of our data leave our network?",
    "Not unless you decide it should. Models, vector stores and logs run inside your cloud account or data center. When a hosted model is the better choice, it runs through your own Azure or AWS tenant, under your contracts.",
  ],
  [
    "Which models do you use?",
    "Whichever wins on your eval suite. Usually an open model such as Llama or Qwen on your GPUs for the volume, and a frontier model in your own cloud account for the hard cases. Switching later is a configuration change.",
  ],
  [
    "How do you know the AI is good enough?",
    "Before we build, we write an eval suite from real examples with your team. Every release runs against it in CI, and a release that scores lower than the last one does not ship.",
  ],
  [
    "Who owns the code and the models?",
    "You do. Code, prompts, eval sets, fine-tuned weights and infrastructure code live in your repositories from the first day.",
  ],
  [
    "Can you work alongside our engineers?",
    "Yes. Most projects pair our team with two or three of your engineers, so the system has owners on your side when we step back.",
  ],
  [
    "What happens after launch?",
    "Either your team takes over with our handover docs, or we keep running it with you on the embedded plan.",
  ],
];

/** Bencho's FAQ accordion, on native details/summary. */
export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto flex max-w-[860px] flex-col gap-12 px-4 py-28 sm:px-6"
    >
      <SectionHead title="Questions we hear on every first call">
        If yours is not here, ask it on the call.
      </SectionHead>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(([name, text]) => ({
              "@type": "Question",
              name,
              acceptedAnswer: { "@type": "Answer", text },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="flex flex-col gap-2">
        {FAQ.map(([q, a]) => (
          <details
            key={q}
            className="reveal group rounded-2xl border border-border-button-default bg-background-primary-default transition-colors duration-150 hover:border-border-button-hover open:bg-background-secondary-default"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-headline-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring [&::-webkit-details-marker]:hidden">
              {q}
              <RiAddLine
                className="size-5 shrink-0 text-foreground-icon-secondary transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              />
            </summary>
            <p className="max-w-[64ch] px-5 pb-5 text-body-regular text-text-secondary">
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Contact --- */

/** Same label treatment the BoardUI Input renders, for fields that take none. */
const FIELD_LABEL = "text-body-medium text-text-primary";

export function Contact() {
  const [start, setStart] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await fetch("/api/contact", {
      method: "POST",
      body: new FormData(e.currentTarget),
    }).catch(() => null);
    setStatus(res?.ok ? "sent" : "error");
  };

  return (
    <section
      id="contact"
      className="mx-auto grid max-w-[1240px] items-start gap-10 px-4 py-28 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="reveal flex flex-col gap-6 lg:sticky lg:top-28">
        <h2 className="text-section-semibold font-stretch-semi-condensed text-balance text-text-primary">
          Bring us one workflow you want gone
        </h2>
        <p className="max-w-[44ch] text-headline-regular text-text-secondary">
          Thirty minutes with an engineer, not a salesperson. We will tell you
          plainly whether AI is the right tool for it.
        </p>
        <MeetingScheduler
          aria-label="Book a discovery call"
          triggerLabel="Pick a time for a call"
          host={{
            name: "StayonSite",
            email: "hello@stayon.site",
            avatarInitial: "S",
          }}
          meeting={{
            title: "30 min discovery call",
            description:
              "Bring one workflow. Leave with an honest answer and a rough price.",
            durationMinutes: 30,
            language: "English or German",
            conferencing: "Video call",
          }}
          className="self-start"
        />
        <p className="text-body-regular text-text-tertiary">
          Or write to{" "}
          <a
            className="text-text-primary underline decoration-separator-border-strong underline-offset-4 hover:decoration-current"
            href="mailto:hello@stayon.site"
          >
            hello@stayon.site
          </a>
        </p>
      </div>

      <form
        onSubmit={submit}
        className="reveal flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-secondary-default p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Your name"
            name="name"
            isRequired
            autoComplete="name"
            placeholder="Dana Okafor"
          />
          <Input
            label="Work email"
            name="email"
            type="email"
            isRequired
            autoComplete="email"
            placeholder="dana@company.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="kind-label" className={FIELD_LABEL}>
            What do you want to build?
          </span>
          <Select
            aria-labelledby="kind-label"
            name="kind"
            defaultSelectedKey="agent"
          >
            <SelectItem id="agent" textValue="An agent that does a task">
              An agent that does a task
            </SelectItem>
            <SelectItem id="search" textValue="Search over our documents">
              Search over our documents
            </SelectItem>
            <SelectItem id="copilot" textValue="A copilot inside our product">
              A copilot inside our product
            </SelectItem>
            <SelectItem id="unsure" textValue="Not sure yet">
              Not sure yet
            </SelectItem>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="where-label" className={FIELD_LABEL}>
            Where should it run?
          </span>
          <RadioGroup
            aria-labelledby="where-label"
            name="where"
            defaultValue="cloud"
            className="grid gap-2 sm:grid-cols-3"
          >
            <RadioCard
              value="cloud"
              title="Our cloud account"
              description="AWS, Azure or GCP"
            />
            <RadioCard
              value="onprem"
              title="Our data center"
              description="Including air-gapped"
            />
            <RadioCard
              value="unsure"
              title="Not sure yet"
              description="We will advise"
            />
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL} aria-hidden>
            Ideal start date
          </span>
          <DatePicker
            aria-label="Ideal start date"
            className="self-start"
            onChange={(d) => setStart(d?.toString() ?? "")}
          />
          <input type="hidden" name="start" value={start} />
        </div>
        <Textarea
          label="Tell us about the workflow"
          name="brief"
          rows={4}
          placeholder="Who does it today, how often, and what it costs you"
        />
        <Checkbox name="nda">Send me your NDA before we talk</Checkbox>
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />
        {status === "sent" ? (
          <Notification
            status="success"
            title="Brief received"
            description="An engineer will reply within one business day."
            dismissible
            onDismiss={() => setStatus("idle")}
          />
        ) : (
          <>
            {status === "error" && (
              <Notification
                status="error"
                title="Could not send"
                description="Please email hello@stayon.site instead."
              />
            )}
            <Button type="submit" className="self-start">
              Send project brief
            </Button>
          </>
        )}
      </form>
    </section>
  );
}
