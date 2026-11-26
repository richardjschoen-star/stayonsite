import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import {
  RiAddLine,
  RiAppleFill,
  RiBankCardLine,
  RiCheckLine,
  RiCheckboxCircleFill,
  RiComputerLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFileTextLine,
  RiGlobalLine,
  RiLock2Line,
  RiQuillPenLine,
  RiRefreshLine,
  RiRocketLine,
  RiShieldCheckLine,
  RiSmartphoneLine,
  RiSparklingLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import {
  buildContractTemplate,
  defaultMilestones,
  fmtAgreementMoney,
  type MilestoneTrigger,
  type PaymentMilestone,
  type ProjectAgreement,
  type ProjectType,
} from "../../agreement";
import { ContractEditor } from "../contract-editor";
import { CelebrationLottie, ContractSealLottie, SuccessCheckLottie } from "../lottie";
import { Sheet, openModal } from "../overlays/layer";
import { Pick } from "../overlays/pickers";
import {
  acceptAgreement,
  agreementOf,
  newId,
  payAgreementMilestone,
  personOf,
  saveAgreement,
  toast,
  triggerAgreementStage,
  useSnap,
} from "../store";
import type { Project, Snapshot } from "../types";

const SPRING = { type: "spring" as const, stiffness: 360, damping: 32 };

const TYPE_OPTIONS: { id: ProjectType; title: string; subtitle: string; icon: typeof RiGlobalLine }[] = [
  { id: "website", title: "Website", subtitle: "Marketing site, web app, SEO & hosting handover", icon: RiGlobalLine },
  { id: "mobile", title: "Mobile App", subtitle: "iOS & Android builds, store submission & repo handover", icon: RiSmartphoneLine },
  { id: "both", title: "Website + Mobile", subtitle: "Unified web & mobile experience with shared APIs", icon: RiComputerLine },
];

const TRIGGER_OPTIONS: { id: MilestoneTrigger; label: string }[] = [
  { id: "contract_accepted", label: "Upon mutual contract acceptance" },
  { id: "customization_shown", label: "After project is customized and shown" },
  { id: "handover", label: "Upon final handover & asset transfer" },
  { id: "custom", label: "Custom milestone" },
];

const PRESETS: { label: string; splits: [number, number, number] }[] = [
  { label: "40 / 40 / 20 (Default)", splits: [40, 40, 20] },
  { label: "50 / 30 / 20", splits: [50, 30, 20] },
  { label: "30 / 40 / 30", splits: [30, 40, 30] },
];

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-2-medium text-text-secondary">{label}</span>
      <Pick label={label} value={value} onChange={(v) => onChange(v as T)} options={options}>
        <span className="flex h-10 w-full items-center justify-between rounded-xl border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary">
          <span className="truncate">{current}</span>
        </span>
      </Pick>
    </div>
  );
}

function fmtTime(ms: number | null) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AgreementView({ p }: { p: Project }) {
  const s = useSnap();
  const saved = agreementOf(s, p.id);
  const staff = s.viewer.staff;
  const [editing, setEditing] = useState(!saved);

  if (!saved && !staff) {
    return (
      <div className="px-4 sm:px-8">
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border-button-default bg-background-secondary-default/40 px-6 py-16 text-center">
          <div className="max-w-md space-y-1.5">
            <h2 className="text-title-2-medium text-text-primary">Onboarding & Contract Pending</h2>
            <p className="text-body-regular text-text-secondary">
              StayonSite is preparing your project brief, contract, and milestone schedule. You’ll be able to review and accept it here shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 sm:px-8">
              {editing && staff ? (
          <div
            key="wizard"
          >
            <OnboardingWizard p={p} s={s} existing={saved} onDone={() => setEditing(false)} onCancel={saved ? () => setEditing(false) : undefined} />
          </div>
        ) : saved ? (
          <div
            key="live"
          >
            <LiveAgreement p={p} s={s} agreement={saved} onEdit={staff ? () => setEditing(true) : undefined} />
          </div>
        ) : null}
          </div>
  );
}

/* ------------------------------------------------ Staff Onboarding Wizard --- */

function OnboardingWizard({
  p,
  s,
  existing,
  onDone,
  onCancel,
}: {
  p: Project;
  s: Snapshot;
  existing: ProjectAgreement | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const clientOwner = s.people.find((x) => !x.staff && (x.role === "owner" || x.role === "admin"));
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);

  const [clientName, setClientName] = useState(existing?.client_name ?? clientOwner?.name ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.client_email ?? clientOwner?.email ?? "");
  const [clientCompany, setClientCompany] = useState(existing?.client_company ?? s.org.name);
  const [projectType, setProjectType] = useState<ProjectType>(existing?.project_type ?? "website");
  const [scopeDescription, setScopeDescription] = useState(existing?.scope_description ?? "");
  const [totalAmount, setTotalAmount] = useState(existing ? String(existing.total_cents / 100) : "12000");
  const [currency, setCurrency] = useState(existing?.currency ?? "USD");
  const [milestones, setMilestones] = useState<PaymentMilestone[]>(() =>
    existing?.milestones?.length ? existing.milestones : defaultMilestones(),
  );

  const totalCents = Math.max(0, Math.round((Number(totalAmount) || 0) * 100));
  const initialTemplate = useMemo(
    () =>
      buildContractTemplate({
        clientName,
        clientEmail,
        clientCompany,
        projectName: p.name,
        projectType,
        scopeDescription,
        totalCents,
        currency,
        milestones,
      }),
    [clientName, clientEmail, clientCompany, p.name, projectType, scopeDescription, totalCents, currency, milestones],
  );

  const [contractTitle, setContractTitle] = useState(existing?.contract_title || initialTemplate.title);
  const [contractBody, setContractBody] = useState(existing?.contract_body || initialTemplate.body);
  const [contractDirty, setContractDirty] = useState(!!existing?.contract_body);

  const regenerateContract = (nextType = projectType, nextMilestones = milestones) => {
    const tpl = buildContractTemplate({
      clientName,
      clientEmail,
      clientCompany,
      projectName: p.name,
      projectType: nextType,
      scopeDescription,
      totalCents,
      currency,
      milestones: nextMilestones,
    });
    setContractTitle(tpl.title);
    setContractBody(tpl.body);
    setContractDirty(false);
  };

  const selectType = (nextType: ProjectType) => {
    setProjectType(nextType);
    if (!contractDirty) regenerateContract(nextType, milestones);
  };

  const pctTotal = milestones.reduce((sum, m) => sum + Number(m.percent || 0), 0);
  const validSplit = Math.round(pctTotal) === 100 && milestones.length > 0;

  const updateMilestone = (idx: number, patch: Partial<PaymentMilestone>) => {
    const next = milestones.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    setMilestones(next);
  };

  const applyPreset = (splits: [number, number, number]) => {
    const base = defaultMilestones();
    const next = base.map((m, i) => ({
      ...m,
      percent: splits[i],
      status: milestones[i]?.status ?? "locked",
      paidAt: milestones[i]?.paidAt ?? null,
      paidBy: milestones[i]?.paidBy ?? null,
      paymentMethod: milestones[i]?.paymentMethod ?? null,
    }));
    setMilestones(next);
  };

  const submit = async () => {
    if (!validSplit) return toast("Milestone percentages must total 100%", { tone: "error" });
    setBusy(true);
    const tpl = buildContractTemplate({
      clientName,
      clientEmail,
      clientCompany,
      projectName: p.name,
      projectType,
      scopeDescription,
      totalCents,
      currency,
      milestones,
    });
    const res = await saveAgreement(p.id, {
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_company: clientCompany.trim(),
      project_type: projectType,
      scope_description: scopeDescription,
      total_cents: totalCents,
      currency,
      contract_title: contractTitle.trim() || tpl.title,
      contract_body: contractBody.trim() || tpl.body,
      milestones,
    });
    setBusy(false);
    if (res) {
      toast("Onboarding & contract saved", { tone: "success" });
      onDone();
    }
  };

  const STEPS = [
    { id: 0 as const, label: "1. Client & Scope" },
    { id: 1 as const, label: "2. Contract & Clauses" },
    { id: 2 as const, label: "3. Payment Schedule" },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Apple-style Segmented Stepper */}
      <div className="flex gap-1.5 rounded-2xl border border-border-button-default bg-background-secondary-default p-1.5">
        {STEPS.map((st) => {
          const active = step === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                if (st.id === 1 && !contractDirty) regenerateContract();
                setStep(st.id);
              }}
              className={cx(
                "relative flex-1 rounded-xl px-3 py-2 text-body-medium transition-colors",
                active ? "text-text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {active && (
                <span
                  layoutId="wizard-pill"
                  className="absolute inset-0 rounded-xl bg-background-primary-default shadow-xs"
                />
              )}
              <span className="relative z-10">{st.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
              {step === 0 && (
          <div
            key="step0"
            className="flex flex-col gap-6 rounded-3xl border border-border-button-default bg-background-primary-default p-5 sm:p-6 [&_input]:rounded-xl [&_input]:border [&_input]:border-border-button-default [&_input]:bg-background-secondary-default [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border-button-default [&_textarea]:bg-background-secondary-default"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Client Company" value={clientCompany} onChange={setClientCompany} placeholder="Acme Corp" />
              <Input label="Client Contact Name" value={clientName} onChange={setClientName} placeholder="Alex Rivera" />
              <Input label="Client Email" value={clientEmail} onChange={setClientEmail} placeholder="alex@acme.com" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-body-medium text-text-primary">Project Type (adds tailored contract clauses)</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = projectType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectType(opt.id)}
                      className={cx(
                        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-colors",
                        selected
                          ? "border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/20"
                          : "border-border-button-default hover:bg-background-secondary-default",
                      )}
                    >
                      <span className={cx("flex size-9 items-center justify-center rounded-xl", selected ? "bg-accent-500 text-text-white" : "bg-background-secondary-default text-foreground-icon-secondary")}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <p className="text-body-semibold text-text-primary">{opt.title}</p>
                        <p className="mt-0.5 text-caption-1-medium text-text-secondary">{opt.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Textarea
              label="Website / App Description & Requirements"
              value={scopeDescription}
              onChange={setScopeDescription}
              rows={4}
              placeholder="Describe the pages, user flows, integrations, design style, and any specific deliverables the client needs..."
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Input label="Total Project Price" value={totalAmount} onChange={setTotalAmount} inputMode="decimal" placeholder="12000" />
              <Choice
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={["USD", "EUR", "GBP", "INR", "AUD", "CAD"].map((c) => ({ id: c, label: c }))}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  if (!contractDirty) regenerateContract();
                  setStep(1);
                }}
              >
                Continue to Contract
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div
            key="step1"
            className="flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-5 sm:p-6 [&_input]:rounded-xl [&_input]:border [&_input]:border-border-button-default [&_input]:bg-background-secondary-default [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border-button-default [&_textarea]:bg-background-secondary-default"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-headline-medium text-text-primary">Contract Template & Clauses</h3>
                <p className="text-body-regular text-text-secondary">
                  Pre-populated with <span className="text-text-primary font-medium">{TYPE_OPTIONS.find((t) => t.id === projectType)?.title}</span> clauses. Edit any section directly.
                </p>
              </div>
              <Button variant="secondary" size="small" leadingIcon={RiRefreshLine} onClick={() => regenerateContract()}>
                Reset from Scope & Type
              </Button>
            </div>

            <Input
              label="Contract Title"
              value={contractTitle}
              onChange={(v) => {
                setContractTitle(v);
                setContractDirty(true);
              }}
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-body-2-medium text-text-secondary">Contract Terms (Tiptap Rich Editor — Editable by Staff)</span>
              <ContractEditor
                value={contractBody}
                editable
                onChange={(html) => {
                  setContractBody(html);
                  setContractDirty(true);
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => setStep(2)}>Continue to Payment Schedule</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div
            key="step2"
            className="flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-5 sm:p-6 [&_input]:rounded-xl [&_input]:border [&_input]:border-border-button-default [&_input]:bg-background-secondary-default [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border-button-default [&_textarea]:bg-background-secondary-default"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-headline-medium text-text-primary">Customizable Milestone Payments</h3>
                <p className="text-body-regular text-text-secondary">
                  Only StayonSite staff can customize these splits. Default is 40% deposit, 40% preview, 20% handover.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((pr) => (
                  <Button key={pr.label} size="xs" variant="secondary" onClick={() => applyPreset(pr.splits)}>
                    {pr.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {milestones.map((ms, idx) => {
                const amt = fmtAgreementMoney(Math.round((totalCents * ms.percent) / 100), currency);
                return (
                  <div
                    key={ms.id}
                    layout
                    className="grid items-end gap-3 rounded-2xl border border-border-button-default bg-background-secondary-default/50 p-4 sm:grid-cols-[1.2fr_1.4fr_110px_110px_auto]"
                  >
                    <Input label={`Milestone ${idx + 1} Label`} value={ms.label} onChange={(label) => updateMilestone(idx, { label })} />
                    <Choice
                      label="Unlock Trigger"
                      value={ms.trigger}
                      onChange={(trigger) => {
                        const found = TRIGGER_OPTIONS.find((t) => t.id === trigger);
                        updateMilestone(idx, { trigger, triggerLabel: found?.label ?? ms.triggerLabel });
                      }}
                      options={TRIGGER_OPTIONS}
                    />
                    <Input
                      label="Percent %"
                      value={String(ms.percent)}
                      inputMode="numeric"
                      onChange={(v) => updateMilestone(idx, { percent: Math.max(0, Math.min(100, Number(v) || 0)) })}
                    />
                    <div className="pb-2 text-end">
                      <p className="text-caption-1-medium text-text-tertiary">Amount</p>
                      <p className="text-body-semibold text-text-primary tabular-nums">{amt}</p>
                    </div>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove milestone"
                        onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}
                        className="mb-1.5 rounded-lg p-2 text-foreground-icon-tertiary hover:bg-background-secondary-hover hover:text-status-rose-text"
                      >
                        <RiDeleteBinLine className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-separator-border bg-background-secondary-default/40 px-4 py-3">
              <Button
                size="small"
                variant="ghost"
                leadingIcon={RiAddLine}
                onClick={() =>
                  setMilestones([
                    ...milestones,
                    {
                      id: newId().slice(0, 8),
                      label: `Milestone ${milestones.length + 1}`,
                      trigger: "custom",
                      triggerLabel: "Upon milestone completion",
                      percent: Math.max(0, 100 - pctTotal),
                      status: "locked",
                      paidAt: null,
                      paidBy: null,
                      paymentMethod: null,
                    },
                  ])
                }
              >
                Add milestone
              </Button>
              <div className="flex items-center gap-3">
                <span className={cx("text-body-semibold tabular-nums", validSplit ? "text-status-lime-text" : "text-status-rose-text")}>
                  Total: {pctTotal}% ({fmtAgreementMoney(totalCents, currency)})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={!validSplit || busy} onClick={submit} leadingIcon={RiSparklingLine}>
                {busy ? "Saving..." : "Save & Publish Agreement"}
              </Button>
            </div>
          </div>
        )}
          </div>
  );
}

/* ------------------------------------------------ Live Agreement & Checkout --- */

function LiveAgreement({
  p,
  s,
  agreement,
  onEdit,
}: {
  p: Project;
  s: Snapshot;
  agreement: ProjectAgreement;
  onEdit?: () => void;
}) {
  const staff = s.viewer.staff;
  const clientAdmin = !staff && (s.viewer.role === "owner" || s.viewer.role === "admin");
  const [busy, setBusy] = useState<string | null>(null);
  const [justCelebrated, setJustCelebrated] = useState(false);

  const bothAccepted = !!agreement.company_accepted_at && !!agreement.client_accepted_at;
  const totalPaidCents = agreement.milestones.reduce(
    (sum, m) => (m.status === "paid" ? sum + Math.round((agreement.total_cents * m.percent) / 100) : sum),
    0,
  );
  const paidPercent = agreement.milestones.reduce((sum, m) => (m.status === "paid" ? sum + m.percent : sum), 0);

  const handleAccept = async (side: "company" | "client") => {
    setBusy(side);
    const res = await acceptAgreement(p.id, side);
    setBusy(null);
    if (res) {
      const bothNow = !!res.company_accepted_at && !!res.client_accepted_at;
      if (bothNow) setJustCelebrated(true);
      toast(bothNow ? "Contract accepted by both parties! Deposit unlocked." : `Contract accepted (${side})`, { tone: "success" });
    }
  };

  const handleTrigger = async (ev: "customization_shown" | "handover_ready") => {
    setBusy(ev);
    const res = await triggerAgreementStage(p.id, ev);
    setBusy(null);
    if (res) {
      toast(ev === "customization_shown" ? "Customization marked shown — 2nd payment unlocked" : "Project marked ready for handover — final payment unlocked", { tone: "success" });
    }
  };

  const openCheckout = (ms: PaymentMilestone) => {
    openModal(
      (close) => (
        <CheckoutModal
          project={p}
          agreement={agreement}
          milestone={ms}
          close={close}
          onPaid={() => setJustCelebrated(true)}
        />
      ),
      "md",
    );
  };

  const companySigner = personOf(s, agreement.company_accepted_by);
  const clientSigner = personOf(s, agreement.client_accepted_by);
  const typeLabel = TYPE_OPTIONS.find((t) => t.id === agreement.project_type)?.title ?? "Website";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Apple-like Summary Hero */}
      <div
        layout
        className="relative overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default p-6"
      >
        {justCelebrated && (
          <div className="pointer-events-none absolute top-2 right-6">
            <CelebrationLottie className="size-28" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-500/10 px-2.5 py-0.5 text-caption-1-semibold text-accent-500">{typeLabel}</span>
                <span className="text-caption-1-medium text-text-tertiary">
                  {agreement.client_company || s.org.name} {agreement.client_name ? `· ${agreement.client_name}` : ""}
                </span>
              </div>
              <h2 className="mt-1 text-title-2-medium text-text-primary">{agreement.contract_title || `${p.name} Agreement`}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-caption-1-medium text-text-tertiary">Total Investment</p>
              <p className="text-title-2-medium text-text-primary tabular-nums">{fmtAgreementMoney(agreement.total_cents, agreement.currency)}</p>
            </div>
            {onEdit && (
              <Button variant="secondary" size="small" leadingIcon={RiEditLine} onClick={onEdit}>
                Edit Terms
              </Button>
            )}
          </div>
        </div>

        {/* Animated Payment Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-caption-1-semibold">
            <span className="text-text-secondary">
              Payment Progress · {fmtAgreementMoney(totalPaidCents, agreement.currency)} paid of {fmtAgreementMoney(agreement.total_cents, agreement.currency)}
            </span>
            <span className="text-text-primary tabular-nums">{paidPercent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-background-tertiary-default">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Contract + Dual Signatures | Milestones & Checkout */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left: Mutual Contract & Signatures */}
        <div className="flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiFileTextLine className="size-5 text-accent-500" />
              <h3 className="text-headline-medium text-text-primary">Project Contract</h3>
            </div>
            <span
              className={cx(
                "rounded-full px-2.5 py-0.5 text-caption-1-semibold",
                bothAccepted ? "bg-status-lime-background text-status-lime-text" : "bg-status-orange-background text-status-orange-text",
              )}
            >
              {bothAccepted ? "Accepted by both parties" : "Awaiting mutual acceptance"}
            </span>
          </div>

          <ContractEditor value={agreement.contract_body} editable={false} />

          {/* Dual Acceptance Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Company Side */}
            <div className={cx("flex flex-col justify-between gap-3 rounded-2xl border p-4", agreement.company_accepted_at ? "border-status-lime-text/30 bg-status-lime-background/50" : "border-border-button-default bg-background-secondary-default/40")}>
              <div>
                <p className="text-caption-1-semibold text-text-tertiary">Company (StayonSite)</p>
                {agreement.company_accepted_at ? (
                  <div className="mt-1.5 flex items-center gap-2 text-body-medium text-text-primary">
                    <RiCheckboxCircleFill className="size-4 text-status-lime-text" />
                    <span>Accepted by {companySigner?.name ?? "Staff"}</span>
                  </div>
                ) : (
                  <p className="mt-1.5 text-body-regular text-text-secondary">Pending company sign-off</p>
                )}
                {agreement.company_accepted_at && (
                  <p className="mt-0.5 text-caption-1-medium text-text-tertiary">{fmtTime(agreement.company_accepted_at)}</p>
                )}
              </div>
              {!agreement.company_accepted_at && staff && (
                <Button size="small" leadingIcon={RiQuillPenLine} disabled={busy === "company"} onClick={() => handleAccept("company")}>
                  {busy === "company" ? "Signing..." : "Accept as Company"}
                </Button>
              )}
            </div>

            {/* Client Side */}
            <div className={cx("flex flex-col justify-between gap-3 rounded-2xl border p-4", agreement.client_accepted_at ? "border-status-lime-text/30 bg-status-lime-background/50" : "border-border-button-default bg-background-secondary-default/40")}>
              <div>
                <p className="text-caption-1-semibold text-text-tertiary">Client ({agreement.client_company || s.org.name})</p>
                {agreement.client_accepted_at ? (
                  <div className="mt-1.5 flex items-center gap-2 text-body-medium text-text-primary">
                    <RiCheckboxCircleFill className="size-4 text-status-lime-text" />
                    <span>Accepted by {clientSigner?.name ?? agreement.client_name ?? "Client"}</span>
                  </div>
                ) : (
                  <p className="mt-1.5 text-body-regular text-text-secondary">
                    {clientAdmin ? "Ready for your review & acceptance" : "Waiting on client owner/admin"}
                  </p>
                )}
                {agreement.client_accepted_at && (
                  <p className="mt-0.5 text-caption-1-medium text-text-tertiary">{fmtTime(agreement.client_accepted_at)}</p>
                )}
              </div>
              {!agreement.client_accepted_at && clientAdmin && (
                <Button size="small" leadingIcon={RiQuillPenLine} disabled={busy === "client"} onClick={() => handleAccept("client")}>
                  {busy === "client" ? "Signing..." : "Accept & Sign Contract"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Milestones & Online Checkout */}
        <div className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-medium text-text-primary">Payment Milestones</h3>
            <span className="text-caption-1-medium text-text-tertiary">
              {agreement.milestones.filter((m) => m.status === "paid").length} of {agreement.milestones.length} paid
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {agreement.milestones.map((ms, idx) => {
              const amountCents = Math.round((agreement.total_cents * ms.percent) / 100);
              const isPaid = ms.status === "paid";
              const isDue = ms.status === "due";
              return (
                <div
                  key={ms.id}
                  layout
                  className={cx(
                    "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                    isPaid
                      ? "border-status-lime-text/30 bg-status-lime-background/40"
                      : isDue
                        ? "border-accent-500/50 bg-accent-500/5"
                        : "border-border-button-default bg-background-secondary-default/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cx(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-caption-1-semibold",
                          isPaid
                            ? "bg-status-lime-text text-text-white"
                            : isDue
                              ? "bg-accent-500 text-text-white"
                              : "bg-background-tertiary-default text-text-tertiary",
                        )}
                      >
                        {isPaid ? <RiCheckLine className="size-4" /> : idx + 1}
                      </span>
                      <div>
                        <p className="text-body-semibold text-text-primary">
                          {ms.label} · {ms.percent}%
                        </p>
                        <p className="text-caption-1-medium text-text-secondary">{ms.triggerLabel}</p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-body-semibold text-text-primary tabular-nums">{fmtAgreementMoney(amountCents, agreement.currency)}</p>
                      <span
                        className={cx(
                          "inline-block rounded-md px-1.5 py-0.5 text-caption-1-medium",
                          isPaid
                            ? "bg-status-lime-background text-status-lime-text"
                            : isDue
                              ? "bg-accent-500/15 text-accent-500"
                              : "bg-background-tertiary-default text-text-tertiary",
                        )}
                      >
                        {isPaid ? `Paid${ms.paymentMethod ? ` · ${ms.paymentMethod}` : ""}` : isDue ? "Due Now" : "Locked"}
                      </span>
                    </div>
                  </div>

                  {isDue && (
                    <Button size="small" leadingIcon={RiBankCardLine} onClick={() => openCheckout(ms)}>
                      Pay {fmtAgreementMoney(amountCents, agreement.currency)} Online
                    </Button>
                  )}

                  {isPaid && ms.paidAt && (
                    <p className="text-caption-1-medium text-text-tertiary">Paid on {fmtTime(ms.paidAt)}</p>
                  )}

                  {/* Staff Stage Triggers for Milestone 2 & 3 */}
                  {staff && ms.status === "locked" && ms.trigger === "customization_shown" && bothAccepted && (
                    <Button
                      size="small"
                      variant="secondary"
                      leadingIcon={RiSparklingLine}
                      disabled={busy === "customization_shown"}
                      onClick={() => handleTrigger("customization_shown")}
                    >
                      Mark Customization Shown (Unlock {ms.percent}%)
                    </Button>
                  )}
                  {staff && ms.status === "locked" && ms.trigger === "handover" && bothAccepted && (
                    <Button
                      size="small"
                      variant="secondary"
                      leadingIcon={RiRocketLine}
                      disabled={busy === "handover_ready"}
                      onClick={() => handleTrigger("handover_ready")}
                    >
                      Ready for Handover (Unlock {ms.percent}%)
                    </Button>
                  )}
                  {ms.status === "locked" && !bothAccepted && (
                    <p className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                      <RiLock2Line className="size-3.5" /> Unlocks after mutual contract acceptance
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ Apple-like Checkout UI --- */

function CheckoutModal({
  project,
  agreement,
  milestone,
  close,
  onPaid,
}: {
  project: Project;
  agreement: ProjectAgreement;
  milestone: PaymentMilestone;
  close: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<"card" | "apple">("card");
  const [cardName, setCardName] = useState(agreement.client_name || "");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [expiry, setExpiry] = useState("08 / 28");
  const [cvc, setCvc] = useState("424");
  const [phase, setPhase] = useState<"form" | "processing" | "done">("form");

  const amountCents = Math.round((agreement.total_cents * milestone.percent) / 100);
  const formatted = fmtAgreementMoney(amountCents, agreement.currency);

  const pay = async () => {
    setPhase("processing");
    await new Promise((r) => setTimeout(r, 1000));
    const res = await payAgreementMilestone(project.id, milestone.id, method === "apple" ? "Apple Pay" : "Card •••• 4242");
    if (res) {
      setPhase("done");
      onPaid();
    } else {
      setPhase("form");
    }
  };

  return (
    <Sheet
      title={phase === "done" ? "Payment Confirmed" : "Secure Milestone Checkout"}
      subtitle={phase === "done" ? undefined : `${project.name} · ${milestone.label} (${milestone.percent}%)`}
      onClose={close}
      footer={
        phase === "form" ? (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={pay} leadingIcon={method === "apple" ? RiAppleFill : RiShieldCheckLine}>
              {method === "apple" ? `Pay ${formatted} with Apple Pay` : `Pay ${formatted}`}
            </Button>
          </>
        ) : phase === "done" ? (
          <Button onClick={close}>Done</Button>
        ) : undefined
      }
    >
              {phase === "form" && (
          <div
            key="form"
            className="flex flex-col gap-5"
          >
            {/* Order Summary */}
            <div className="flex items-center justify-between rounded-2xl border border-separator-border bg-background-secondary-default/50 p-4">
              <div>
                <p className="text-body-semibold text-text-primary">{milestone.label}</p>
                <p className="text-caption-1-medium text-text-secondary">
                  {milestone.percent}% of {fmtAgreementMoney(agreement.total_cents, agreement.currency)} · {milestone.triggerLabel}
                </p>
              </div>
              <p className="text-title-2-medium text-text-primary tabular-nums">{formatted}</p>
            </div>

            {/* Method Toggle */}
            <div className="flex gap-1.5 rounded-2xl border border-border-button-default bg-background-secondary-default p-1">
              {(
                [
                  { id: "card", label: "Credit / Debit Card", icon: RiBankCardLine },
                  { id: "apple", label: "Apple Pay", icon: RiAppleFill },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cx("relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-body-medium transition-colors", active ? "text-text-primary" : "text-text-secondary")}
                  >
                    {active && <span layoutId="pay-method" className="absolute inset-0 rounded-xl bg-background-primary-default shadow-xs" />}
                    <Icon className="relative z-10 size-4" />
                    <span className="relative z-10">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {method === "card" ? (
              <div className="grid gap-3">
                <Input label="Cardholder Name" value={cardName} onChange={setCardName} placeholder="Alex Rivera" />
                <Input label="Card Number" value={cardNumber} onChange={setCardNumber} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Expiry" value={expiry} onChange={setExpiry} />
                  <Input label="CVC" value={cvc} onChange={setCvc} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-button-default bg-background-secondary-default/40 p-6 text-center">
                <RiAppleFill className="size-10 text-text-primary" />
                <p className="text-body-semibold text-text-primary">Express Checkout Ready</p>
                <p className="text-caption-1-medium text-text-secondary">
                  Confirm below to authorize {formatted} for {project.name}.
                </p>
              </div>
            )}

            <p className="flex items-center justify-center gap-1.5 text-caption-1-medium text-text-tertiary">
              <RiShieldCheckLine className="size-4" /> UI Preview Mode — live payment gateway (Stripe) will connect here.
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div
            key="processing"
            className="flex flex-col items-center justify-center gap-3 py-12 text-center"
          >
            <div className="size-10 animate-spin rounded-full border-3 border-accent-500/20 border-t-accent-500" />
            <p className="text-body-semibold text-text-primary">Authorizing {formatted}…</p>
            <p className="text-caption-1-medium text-text-secondary">Confirming milestone payment</p>
          </div>
        )}

        {phase === "done" && (
          <div
            key="done"
            className="relative flex flex-col items-center justify-center gap-3 py-8 text-center"
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <CelebrationLottie className="size-40" />
            </div>
            <SuccessCheckLottie className="size-20" />
            <h3 className="text-title-2-medium text-text-primary">{formatted} Paid</h3>
            <p className="max-w-sm text-body-regular text-text-secondary">
              {milestone.label} ({milestone.percent}%) is now marked paid on {project.name}.
            </p>
          </div>
        )}
          </Sheet>
  );
}
