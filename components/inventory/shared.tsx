"use client";

/**
 * Small shared pieces for the inventory module: the badges that encode stock and
 * expiry state, deterministic date formatting, and the filter vocabulary the list
 * page and its table both speak.
 *
 * The tone helpers in `lib/domain/selectors` return token NAMES as plain strings
 * so the domain layer stays free of UI types. `toBadgeTone` is the one place that
 * narrows them back to the `Badge` union, so an unknown tone degrades to neutral
 * instead of rendering an unstyled chip.
 */

import * as React from "react";

import { Badge, type BadgeTone } from "@/components/ui";
import { rupeesToPaise } from "@/lib/domain/money";
import {
  daysUntil,
  expiryStateLabel,
  expiryStateOf,
  expiryStateTone,
  scheduleLabel,
  scheduleTone,
  stockStateLabel,
  stockStateTone,
} from "@/lib/domain/selectors";
import type { DrugSchedule, ExpiryState, StockState } from "@/lib/domain/types";

// ─────────────────────────── tones ───────────────────────────

const BADGE_TONES = new Set<string>([
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "accent",
]);

export function toBadgeTone(tone: string): BadgeTone {
  return (BADGE_TONES.has(tone) ? tone : "neutral") as BadgeTone;
}

// ─────────────────────────── dates ───────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Placeholder for an absent value. A blank cell reads as a rendering bug. */
export const EMPTY_CELL = "-";

/**
 * `2026-08-18` → `18 Aug 2026`. Read in UTC because an expiry is a calendar
 * fact, not an instant: shifting it into the local zone would move a batch a day
 * either side of midnight depending on where the browser happens to be.
 */
export function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return EMPTY_CELL;
  return `${String(at.getUTCDate()).padStart(2, "0")} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/** Ledger timestamps are real instants, so these are shown in local time. */
export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return EMPTY_CELL;
  const day = String(at.getDate()).padStart(2, "0");
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${day} ${MONTHS[at.getMonth()]} ${at.getFullYear()}, ${hh}:${mm}`;
}

/** "42 days left" / "expired 12 days ago". Never a bare negative number. */
export function formatDaysLeft(expiryDate: string, now: Date): string {
  const days = daysUntil(expiryDate, now);
  if (Number.isNaN(days)) return EMPTY_CELL;
  if (days < 0) return `expired ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "expires today";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

/** `<input type="date">` speaks YYYY-MM-DD and so does every expiry we store. */
export function todayISODate(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

// ─────────────────────────── badges ───────────────────────────

export function StockBadge({ state }: { state: StockState }) {
  return (
    <Badge size="sm" dot tone={toBadgeTone(stockStateTone(state))}>
      {stockStateLabel(state)}
    </Badge>
  );
}

export function ExpiryBadge({ state }: { state: ExpiryState }) {
  return (
    <Badge size="sm" dot tone={toBadgeTone(expiryStateTone(state))}>
      {expiryStateLabel(state)}
    </Badge>
  );
}

export function ScheduleBadge({ schedule }: { schedule: DrugSchedule }) {
  return (
    <Badge size="sm" tone={toBadgeTone(scheduleTone(schedule))}>
      {scheduleLabel(schedule)}
    </Badge>
  );
}

export function expiryStateFor(
  expiryDate: string,
  now: Date,
  warningDays: number,
): ExpiryState {
  return expiryStateOf(expiryDate, now, warningDays);
}

// ─────────────────────────── filters ───────────────────────────

export type StockFilter = "ALL" | "OUT" | "CRITICAL" | "LOW" | "OK";
export type ExpiryFilter = "ALL" | "EXPIRED" | "D30" | "D90";

export const ALL_CATEGORIES = "ALL";

// ─────────────────────────── misc ───────────────────────────

/** One `now` per mount. Recreating it every render would make every memo below
 *  it recompute on every keystroke, and expiry state would flicker at midnight. */
export function useNow(): Date {
  return React.useMemo(() => new Date(), []);
}

/** "1 strip" / "6 strips". Unit labels in this catalogue all pluralise regularly. */
export function pluralUnit(count: number, unitLabel: string): string {
  return count === 1 ? unitLabel : `${unitLabel}s`;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

let localIdCounter = 0;

/** Ids for records minted in the browser. Only ever called from an event
 *  handler, i.e. after hydration, so the timestamp cannot desync SSR markup. */
export function makeLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${localIdCounter.toString(36).padStart(2, "0")}`;
}

/** Rupee text from an operator → paise. Rejects anything that is not a number,
 *  so an empty field can never silently become ₹0.00 on a purchase invoice. */
export function parseRupees(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return rupeesToPaise(value);
}

export function parseCount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null;
  return value;
}
