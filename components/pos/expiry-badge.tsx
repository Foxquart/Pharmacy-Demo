"use client";

import { Badge, type BadgeSize, type BadgeTone } from "@/components/ui";
import {
  daysUntil,
  expiryStateLabel,
  expiryStateOf,
  expiryStateTone,
  scheduleLabel,
  scheduleTone,
  stockStateLabel,
  stockStateOf,
  stockStateTone,
} from "@/lib/domain/selectors";
import type { DrugSchedule } from "@/lib/domain/types";

/**
 * The selectors hand back tone names as plain strings so the domain layer stays
 * free of any UI import. This is the one place that narrows them back to the
 * Badge union, so a tone the design system does not own degrades to neutral
 * instead of painting an undefined class.
 */
const BADGE_TONES: readonly BadgeTone[] = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "accent",
];

export function toBadgeTone(tone: string): BadgeTone {
  return BADGE_TONES.find((candidate) => candidate === tone) ?? "neutral";
}

const MONTHS = [
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
] as const;

/**
 * Expiry is a calendar fact printed on a carton, so it is formatted straight
 * from the ISO parts. Passing it through `new Date()` would shift the day for
 * anyone east or west of UTC, and a batch that retires a day early at the
 * counter is a batch the pharmacist stops trusting the software about.
 */
export function formatExpiry(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthIndex = Number(month) - 1;
  const name = MONTHS[monthIndex];
  if (!year || !day || !name) return iso;
  return `${day} ${name} ${year}`;
}

/** Month and year only, for tight controls where the day does not change the call. */
export function formatExpiryShort(iso: string): string {
  const [year, month] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!year || !name) return iso;
  return `${name} ${year}`;
}

export interface ExpiryBadgeProps {
  expiryDate: string;
  now: Date;
  warningDays: number;
  /** Render the calm "Good" state too. Off by default: silence is the good state. */
  showOk?: boolean;
  size?: BadgeSize;
}

/** Expiry is the safety-critical fact on this screen, so it is always a badge,
 *  never a colour on a date string alone. */
export function ExpiryBadge({
  expiryDate,
  now,
  warningDays,
  showOk = false,
  size = "sm",
}: ExpiryBadgeProps) {
  const state = expiryStateOf(expiryDate, now, warningDays);
  if (state === "OK" && !showOk) return null;

  const days = daysUntil(expiryDate, now);
  const label =
    state === "EXPIRED"
      ? `Expired ${Number.isNaN(days) ? "" : `${Math.abs(days)}d ago`}`.trim()
      : state === "OK"
        ? "Good"
        : `${expiryStateLabel(state)}, ${days}d`;

  return (
    <Badge tone={toBadgeTone(expiryStateTone(state))} size={size} dot>
      {label}
    </Badge>
  );
}

export function ScheduleBadge({
  schedule,
  size = "sm",
}: {
  schedule: DrugSchedule;
  size?: BadgeSize;
}) {
  return (
    <Badge tone={toBadgeTone(scheduleTone(schedule))} size={size}>
      {scheduleLabel(schedule)}
    </Badge>
  );
}

export function StockBadge({
  quantity,
  reorderLevel,
  unitLabel,
  size = "sm",
}: {
  quantity: number;
  reorderLevel: number;
  unitLabel: string;
  size?: BadgeSize;
}) {
  const state = stockStateOf(quantity, reorderLevel);
  const tone = toBadgeTone(stockStateTone(state));

  if (state === "OUT") {
    return (
      <Badge tone={tone} size={size} dot>
        {stockStateLabel(state)}
      </Badge>
    );
  }

  return (
    <Badge tone={tone} size={size} dot>
      <span className="numeric">{quantity}</span>
      <span className="ml-1">{quantity === 1 ? unitLabel : `${unitLabel}s`}</span>
    </Badge>
  );
}
