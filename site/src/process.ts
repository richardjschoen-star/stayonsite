/**
 * The way StayonSite works with a client, shared by the marketing site's
 * Process section and the console, where each project walks these steps.
 */

/** The four delivery phases, as sold on the marketing site. */
export const STEPS = [
  {
    id: "discover",
    name: "Discovery",
    length: "1 week",
    body: "We sit with the people doing the work, read the actual data and pick the one workflow worth automating first. You get a fixed quote, not an estimate.",
    gets: [
      "Shortlist of workflows, ranked by payback",
      "Data readiness review",
      "Architecture for your environment",
      "Fixed price for the build",
    ],
  },
  {
    id: "prototype",
    name: "Prototype",
    length: "2 to 3 weeks",
    body: "A working version on a copy of your real data, inside your environment, used by a handful of the people who will use it every day.",
    gets: [
      "Working agent or copilot",
      "First eval suite from real examples",
      "Weekly demo with your team",
      "Go or no-go with numbers",
    ],
  },
  {
    id: "production",
    name: "Production",
    length: "6 to 10 weeks",
    body: "Hardening for everyone: guardrails, single sign-on, monitoring and a staged rollout. Nothing ships unless it beats the last release on the eval suite.",
    gets: [
      "Eval gate in your CI",
      "Guardrails and audit log",
      "Staged rollout plan",
      "Runbooks and handover docs",
    ],
  },
  {
    id: "operate",
    name: "Operate",
    length: "Monthly",
    body: "We keep it sharp with you: new eval cases from real failures, model upgrades when they pay off, cost reviews and on-call for incidents.",
    gets: [
      "Monthly quality and cost report",
      "Model upgrades",
      "On-call for production",
      "Quarterly roadmap review",
    ],
  },
];

export type Gate = "sign" | "approve" | "go" | "accept";

export interface EngagementStep {
  n: number;
  phase: "sales" | "delivery";
  name: string;
  length: string;
  /** The client sign-off that closes the step, if any. */
  gate: Gate | null;
  items: string[];
}

export const GATES: Record<Gate, { label: string; verb: string }> = {
  sign: { label: "Signature", verb: "Sign" },
  approve: { label: "Approval", verb: "Approve" },
  go: { label: "Go / no-go", verb: "Go" },
  accept: { label: "Acceptance", verb: "Accept" },
};

const [discover, prototype, production, operate] = STEPS;

/** Every engagement, from first contact to running it together. */
export const ENGAGEMENT: EngagementStep[] = [
  { n: 1, phase: "sales", name: "Inquiry", length: "Day 1", gate: null, items: ["Brief received", "Reply within one working day"] },
  { n: 2, phase: "sales", name: "Discovery call", length: "45 minutes", gate: null, items: ["Call booked", "Goals and constraints written up", "Decision makers named"] },
  { n: 3, phase: "sales", name: "NDA", length: "1 to 3 days", gate: "sign", items: ["Mutual NDA sent", "Signed by both sides"] },
  { n: 4, phase: "sales", name: "Proposal and quote", length: "1 week", gate: "approve", items: ["Scope and approach", "Fixed price per phase", "Timeline"] },
  { n: 5, phase: "sales", name: "SOW and deposit", length: "1 week", gate: "sign", items: ["Statement of work signed", "Deposit invoice paid"] },
  { n: 6, phase: "sales", name: "Kickoff", length: "1 day", gate: null, items: ["Team introductions", "Access to environment and data", "Weekly demo slot booked"] },
  { n: 7, phase: "delivery", name: discover.name, length: discover.length, gate: null, items: discover.gets },
  { n: 8, phase: "delivery", name: prototype.name, length: prototype.length, gate: "go", items: prototype.gets },
  { n: 9, phase: "delivery", name: production.name, length: production.length, gate: null, items: production.gets },
  { n: 10, phase: "delivery", name: "Handover", length: "1 week", gate: "accept", items: ["Runbooks reviewed with your team", "Access and keys transferred", "Acceptance sign-off"] },
  { n: 11, phase: "delivery", name: operate.name, length: operate.length, gate: null, items: operate.gets },
];
