"use client";

import * as React from "react";
import { TrendDown, TrendUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type StatDeltaDirection = "up" | "down" | "flat";
export type StatDeltaTone = "success" | "danger" | "neutral";

export interface StatDelta {
  /** Pre-formatted, e.g. "+12.4%" or "₹1,240". */
  value: React.ReactNode;
  direction: StatDeltaDirection;
  /** Up is not always good — "expired units, up 8" is bad news. Override here. */
  tone?: StatDeltaTone;
  /** Period this delta is measured against, e.g. "vs. last week". */
  label?: React.ReactNode;
}

const DELTA_TONE: Record<StatDeltaTone, string> = {
  success: "border-success-border bg-success-subtle text-success-text",
  danger: "border-danger-border bg-danger-subtle text-danger-text",
  neutral: "border-border bg-bg-sunken text-text-secondary",
};

function resolveTone(delta: StatDelta): StatDeltaTone {
  if (delta.tone) return delta.tone;
  if (delta.direction === "up") return "success";
  if (delta.direction === "down") return "danger";
  return "neutral";
}

export interface StatProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  label: React.ReactNode;
  /** Already formatted — this component never does arithmetic or currency logic. */
  value: React.ReactNode;
  /** Small unit or qualifier trailing the value, e.g. "units", "/ 240". */
  unit?: React.ReactNode;
  delta?: StatDelta;
  /** One quiet line under the value: what the number means or where it came from. */
  hint?: React.ReactNode;
  /** Small leading icon beside the label. */
  icon?: React.ReactNode;
  /** Draw the card chrome. Off when the tile sits inside an existing Card. */
  bordered?: boolean;
}

/** A dashboard tile: label, one big number, an optional delta and hint.
 *  Deliberately no progress track — a filled bar implies a target that a
 *  pharmacy metric usually does not have, and it reads as decoration. */
export const Stat = React.forwardRef<HTMLDivElement, StatProps>(function Stat(
  { className, label, value, unit, delta, hint, icon, bordered = true, ...props },
  ref,
) {
  const tone = delta ? resolveTone(delta) : "neutral";
  const DeltaIcon =
    delta?.direction === "up" ? TrendUp : delta?.direction === "down" ? TrendDown : null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2",
        bordered && "rounded-[var(--radius-lg)] border border-border bg-surface p-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span className="inline-flex shrink-0 items-center text-text-tertiary" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="text-xs font-medium tracking-wide text-text-secondary">{label}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* `numeric` = mono face + tabular figures, so the digits never reflow
            as the value ticks and tiles line up across the row. */}
        <span className="numeric text-[1.375rem] leading-none font-medium text-text sm:text-2xl">
          {value}
        </span>
        {unit ? <span className="text-xs text-text-tertiary">{unit}</span> : null}
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-0.5",
              "text-[0.6875rem] font-medium",
              DELTA_TONE[tone],
            )}
          >
            {DeltaIcon ? <DeltaIcon size={11} weight="bold" aria-hidden="true" /> : null}
            <span className="numeric">{delta.value}</span>
          </span>
        ) : null}
      </div>

      {delta?.label || hint ? (
        <p className="text-[0.6875rem] leading-snug text-text-tertiary">
          {delta?.label}
          {delta?.label && hint ? " · " : null}
          {hint}
        </p>
      ) : null}
    </div>
  );
});
