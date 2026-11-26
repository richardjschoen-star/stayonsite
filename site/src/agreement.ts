/**
 * Shared contract templates and customizable milestone payment defaults
 * for website & mobile app onboarding.
 */

export type ProjectType = "website" | "mobile" | "both";

export type MilestoneTrigger = "contract_accepted" | "customization_shown" | "handover" | "custom";

export interface PaymentMilestone {
  id: string;
  label: string;
  trigger: MilestoneTrigger;
  triggerLabel: string;
  percent: number;
  status: "locked" | "due" | "paid";
  paidAt: number | null;
  paidBy: string | null;
  paymentMethod: string | null;
  invoiceId?: string | null;
}

export interface ProjectAgreement {
  project_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  project_type: ProjectType;
  scope_description: string;
  total_cents: number;
  currency: string;
  contract_title: string;
  contract_body: string;
  company_accepted_by: string | null;
  company_accepted_at: number | null;
  client_accepted_by: string | null;
  client_accepted_at: number | null;
  preview_shown_at: number | null;
  handover_ready_at: number | null;
  milestones: PaymentMilestone[];
  updated_at: number;
}

export function defaultMilestones(): PaymentMilestone[] {
  return [
    {
      id: "m1",
      label: "Project Kickoff Deposit",
      trigger: "contract_accepted",
      triggerLabel: "Upon mutual contract acceptance",
      percent: 40,
      status: "locked",
      paidAt: null,
      paidBy: null,
      paymentMethod: null,
    },
    {
      id: "m2",
      label: "Customization & Preview",
      trigger: "customization_shown",
      triggerLabel: "After project is customized and shown",
      percent: 40,
      status: "locked",
      paidAt: null,
      paidBy: null,
      paymentMethod: null,
    },
    {
      id: "m3",
      label: "Final Project Handover",
      trigger: "handover",
      triggerLabel: "Upon final handover & asset transfer",
      percent: 20,
      status: "locked",
      paidAt: null,
      paidBy: null,
      paymentMethod: null,
    },
  ];
}

export function fmtAgreementMoney(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(0)}`;
  }
}

const TYPE_LABEL: Record<ProjectType, string> = {
  website: "Website",
  mobile: "Mobile App",
  both: "Website & Mobile App",
};

const WEBSITE_CLAUSES = `<h3>3. Website Deliverables &amp; Technical Standards</h3>
<ul>
  <li><strong>Responsive Design:</strong> Full layout adaptation across desktop, tablet, and mobile viewports.</li>
  <li><strong>Performance &amp; SEO:</strong> Clean semantic markup, metadata, Open Graph tags, and Core Web Vitals optimization.</li>
  <li><strong>Hosting &amp; Domain Handover:</strong> Deployment configuration, SSL setup, and full DNS/hosting transfer upon final payment.</li>
</ul>`;

const MOBILE_CLAUSES = `<h3>3. Mobile App Deliverables &amp; Store Readiness</h3>
<ul>
  <li><strong>Platform Builds:</strong> Production-ready builds for iOS (App Store) and/or Android (Google Play) as specified.</li>
  <li><strong>Device Capabilities:</strong> Proper handling of permissions, push notifications, and offline/network states.</li>
  <li><strong>Store Submission &amp; Handover:</strong> App Store Connect / Google Play Console submission support and full source repository transfer upon final payment.</li>
</ul>`;

const BOTH_CLAUSES = `<h3>3. Website &amp; Mobile App Deliverables</h3>
<ul>
  <li><strong>Web Platform:</strong> Responsive web application across desktop, tablet, and mobile viewports with SEO &amp; performance optimization.</li>
  <li><strong>Mobile Applications:</strong> Production-ready iOS and Android builds with device permission handling and store-readiness compliance.</li>
  <li><strong>Unified Backend &amp; Handover:</strong> Shared API synchronization plus full transfer of domain, hosting, store accounts, and source repositories upon final payment.</li>
</ul>`;

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export function buildContractTemplate(input: {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  projectName: string;
  projectType: ProjectType;
  scopeDescription: string;
  totalCents: number;
  currency: string;
  milestones: PaymentMilestone[];
}) {
  const typeLabel = TYPE_LABEL[input.projectType];
  const clientLabel = esc(input.clientCompany || input.clientName || "Client");
  const contactName = input.clientName ? `, represented by <strong>${esc(input.clientName)}</strong>` : "";
  const contactEmail = input.clientEmail ? ` (${esc(input.clientEmail)})` : "";
  const totalFormatted = fmtAgreementMoney(input.totalCents, input.currency);
  const typeClause =
    input.projectType === "website"
      ? WEBSITE_CLAUSES
      : input.projectType === "mobile"
        ? MOBILE_CLAUSES
        : BOTH_CLAUSES;

  const scheduleLines = input.milestones
    .map((m) => {
      const amt = fmtAgreementMoney(Math.round((input.totalCents * m.percent) / 100), input.currency);
      return `<li><strong>${esc(m.label)} — ${m.percent}% (${esc(amt)}):</strong> Due ${esc(m.triggerLabel.toLowerCase())}.</li>`;
    })
    .join("");

  const scopeHtml = esc(
    input.scopeDescription.trim() || "Custom design, development, and deployment as discussed during discovery.",
  ).replace(/\n/g, "<br>");

  return {
    title: `${typeLabel} Development & Services Agreement`,
    body: `<h2>Master Services Agreement — ${esc(typeLabel)}</h2>
<h3>1. Parties &amp; Client Information</h3>
<p>This Agreement is entered into between <strong>StayonSite</strong> ("Company") and <strong>${clientLabel}</strong> ("Client")${contactName}${contactEmail}.</p>
<h3>2. Project Scope &amp; Description (${esc(input.projectName || "Project")})</h3>
<p><strong>Project Type:</strong> ${esc(typeLabel)}<br><strong>Total Investment:</strong> ${esc(totalFormatted)} (${esc(input.currency)})</p>
<p><strong>Scope Summary:</strong><br>${scopeHtml}</p>
${typeClause}
<h3>4. Payment Schedule &amp; Milestones</h3>
<p>Payments are structured in ${input.milestones.length} milestone(s) totaling <strong>100% (${esc(totalFormatted)})</strong>:</p>
<ol>${scheduleLines}</ol>
<h3>5. Mutual Acceptance &amp; Workflow</h3>
<p>Work commences only after both Company and Client have reviewed and accepted this Agreement and the initial milestone payment is completed. Subsequent milestones unlock upon customization preview and final handover.</p>
<h3>6. Intellectual Property &amp; Confidentiality</h3>
<p>Upon receipt of final milestone payment, all custom deliverables, source code, and design assets created specifically for Client under this Agreement transfer to Client. Both parties agree to keep proprietary business and technical information confidential.</p>`,
  };
}
