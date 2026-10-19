"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { useState } from "react";
import {
  RiAlarmWarningFill,
  RiEyeOffFill,
  RiFlaskFill,
  RiMoneyDollarCircleFill,
  RiShieldCheckFill,
  RiUserFollowFill,
} from "@remixicon/react";
import type { ComponentType } from "react";
import { WeekRangePill } from "@/components/application/medical/week-range-pill";
import { cx } from "@/utils/cx";

/**
 * Figma source: Board UI → medical profile dashboard → Frame 126 (node
 * 3950:5936). Alert feed: tinted icon circle, title + description, and a
 * soft date pill absolutely pinned to the row's top-right corner.
 *
 * The feed runs flush to the card's bottom edge and clips there (the card
 * keeps its 10px inset on the other three sides only) — per Figma, where
 * the third alert row is visibly cut off by the card bounds. The scroll
 * content itself ends with a 10px pad so the last alert doesn't sit hard
 * against that edge once you reach the bottom, and a card-colored gradient
 * fades in over the top edge while scrolled so rows dissolve out instead
 * of being sharply cut by the header.
 */

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

type Alert = { icon: IconComponent; iconBg: string; iconFg?: string; title: string; description: string; date: string };

const ALERTS: Alert[] = [
  {
    icon: RiShieldCheckFill,
    iconBg: "bg-accent-500",
    title: "Prompt injection blocked",
    description: "A ticket asked the support agent to ignore its instructions and export customer emails. The request was refused and logged.",
    date: "Oct 19",
  },
  {
    icon: RiEyeOffFill,
    iconBg: "bg-accent-700",
    title: "PII redacted",
    description: "41 card numbers and 12 passport IDs were masked before reaching the model this week.",
    date: "Oct 19",
  },
  {
    icon: RiUserFollowFill,
    iconBg: "bg-brand-yellow",
    iconFg: "text-brand-on-yellow",
    title: "Approval needed",
    description: "The agent wants to refund $640 on order #88213. Refunds over $500 wait for a person.",
    date: "Oct 18",
  },
  {
    icon: RiFlaskFill,
    iconBg: "bg-accent-500",
    title: "Eval regression caught",
    description: "Release v15 dropped answer accuracy from 94% to 89% on the returns test set, so it was held back.",
    date: "Oct 17",
  },
  {
    icon: RiMoneyDollarCircleFill,
    iconBg: "bg-accent-700",
    title: "Token spend spike",
    description: "Daily inference cost rose 38% after a retry loop in the order-lookup tool. A fix shipped the same day.",
    date: "Oct 15",
  },
  {
    icon: RiAlarmWarningFill,
    iconBg: "bg-brand-yellow",
    iconFg: "text-brand-on-yellow",
    title: "Model drift",
    description: "Intent classification confidence fell below 0.8 for the new loyalty-program questions.",
    date: "Oct 14",
  },
];

/** Total alerts logged this week — higher than `ALERTS.length` since the
 *  feed below only lists the most recent ones, not the full history. */
const ALERTS_THIS_WEEK_COUNT = 12;

export function ImportantAlertsCard({ className }: { className?: string } = {}) {
  const localize = useTemplateCopy();
  const [scrolled, setScrolled] = useState(false);

  return localize((
    <section
      className={cx(
        // The 1px border matches the card's own bg — invisible as a line,
        // but content clips at the padding box (inside the border), so the
        // white alert rows stop 1px shy of the rounded edge instead of
        // touching it when scrolled to the bottom.
        "flex h-[330px] w-full min-w-0 flex-col gap-4 overflow-hidden rounded-[20px] border border-background-secondary-default bg-background-secondary-default px-2.5 pt-2.5",
        className,
      )}
    >
      <div className="flex w-full items-start justify-between gap-2 px-1.5 pt-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-body-medium text-text-secondary">Guardrail alerts</p>
          <div className="flex items-baseline gap-1">
            <p className="text-title-1-medium whitespace-nowrap text-text-primary tabular-nums">
              {ALERTS_THIS_WEEK_COUNT}
            </p>
            <span className="text-caption-1-medium whitespace-nowrap text-text-secondary">this week</span>
          </div>
        </div>
        <WeekRangePill label="13 – 19 Oct" />
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <div
          className="flex h-full w-full flex-col gap-2.5 overflow-y-auto overscroll-contain pb-2.5"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        >
          {ALERTS.map((alert, index) => (
            <div
              key={`${alert.title}-${index}`}
              className="relative flex w-full shrink-0 flex-col gap-2 rounded-2lg bg-background-inner-default p-2.5"
            >
              <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", alert.iconBg)}>
                <alert.icon className={cx("size-[18px]", alert.iconFg ?? "text-white")} aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-body-medium whitespace-nowrap text-text-primary">{alert.title}</p>
                <p className="text-body-2-regular text-text-secondary">{alert.description}</p>
              </div>
              <span className="absolute top-2.5 end-2.5 rounded-md bg-background-secondary-default px-1.5 py-px text-body-medium whitespace-nowrap text-text-secondary">
                {alert.date}
              </span>
            </div>
          ))}
        </div>
        {/* Top fade — card-colored gradient that eases in once the feed is
            scrolled, so rows dissolve under the header instead of cutting. */}
        <div
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background-secondary-default to-transparent",
            "transition-opacity duration-200 ease-out",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </section>
  ));
}
