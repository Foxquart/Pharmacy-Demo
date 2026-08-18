"use client";

/**
 * Daily takings for the reporting window, drawn with plain divs.
 *
 * No chart library: a column chart is a flex row of divs whose heights are a
 * percentage of the tallest column, and pulling in a charting dependency would
 * also pull in its own colour system, which is exactly what the token rules
 * forbid.
 *
 * Accessibility: every column is a real `<button>` that promotes its day into
 * the readout above the chart, so the series is reachable by keyboard and each
 * bar carries its figure in its accessible name. The same numbers are also
 * printed in the table underneath — colour and height are never the only
 * carrier of a value here.
 */

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatPaise, formatPaiseTight } from "@/lib/domain/money";
import type { Bill } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** UTC calendar day of an ISO timestamp. The seed stamps bills off UTC midnight,
 *  and expiry/day maths across the app is UTC-floored, so grouping matches. */
function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

const DAY_MS = 86_400_000;

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const FULL_LABEL = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export interface SalesDay {
  dayKey: string;
  label: string;
  weekday: string;
  fullLabel: string;
  totalPaise: number;
  billCount: number;
  unitCount: number;
}

export function buildSalesSeries(bills: Bill[], now: Date, days: number): SalesDay[] {
  const byDay = new Map<string, { totalPaise: number; billCount: number; unitCount: number }>();

  for (const bill of bills) {
    if (bill.status !== "PAID") continue;
    const key = dayKeyOf(bill.paidAt ?? bill.createdAt);
    const bucket = byDay.get(key) ?? { totalPaise: 0, billCount: 0, unitCount: 0 };
    bucket.totalPaise += bill.totalPaise;
    bucket.billCount += 1;
    for (const item of bill.items) bucket.unitCount += item.quantity;
    byDay.set(key, bucket);
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const series: SalesDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(todayUtc - offset * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    series.push({
      dayKey: key,
      label: DAY_LABEL.format(date),
      weekday: WEEKDAY_LABEL.format(date),
      fullLabel: FULL_LABEL.format(date),
      totalPaise: bucket?.totalPaise ?? 0,
      billCount: bucket?.billCount ?? 0,
      unitCount: bucket?.unitCount ?? 0,
    });
  }
  return series;
}

export interface SalesChartProps {
  bills: Bill[];
  now: Date;
  days: number;
}

export function SalesChart({ bills, now, days }: SalesChartProps) {
  const series = React.useMemo(() => buildSalesSeries(bills, now, days), [bills, now, days]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const peakPaise = series.reduce((max, day) => (day.totalPaise > max ? day.totalPaise : max), 0);
  const windowTotalPaise = series.reduce((sum, day) => sum + day.totalPaise, 0);
  const tradingDays = series.filter((day) => day.billCount > 0).length;
  // Paise in, paise out: an average of integers, floored back to an integer.
  const averagePaise = tradingDays > 0 ? Math.round(windowTotalPaise / tradingDays) : 0;

  const selected =
    series.find((day) => day.dayKey === selectedKey) ?? series[series.length - 1] ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Sales, last {days} days</CardTitle>
            <CardDescription>
              Bill totals as the shop books them, before the gateway takes its cut. Select a
              column to read its day.
            </CardDescription>
          </div>
          {selected ? (
            <div
              aria-live="polite"
              className="min-w-[10rem] rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2"
            >
              <p className="text-[0.75rem] text-text-secondary">{selected.fullLabel}</p>
              <p className="numeric text-[1.0625rem] font-medium text-text">
                {formatPaise(selected.totalPaise)}
              </p>
              <p className="text-[0.75rem] text-text-tertiary">
                <span className="numeric">{selected.billCount}</span> bills ·{" "}
                <span className="numeric">{selected.unitCount}</span> units
              </p>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem] text-text-secondary">
          <span>
            Window total{" "}
            <span className="numeric font-medium text-text">{formatPaise(windowTotalPaise)}</span>
          </span>
          <span>
            Best day{" "}
            <span className="numeric font-medium text-text">{formatPaise(peakPaise)}</span>
          </span>
          <span>
            Average trading day{" "}
            <span className="numeric font-medium text-text">{formatPaise(averagePaise)}</span>
          </span>
        </div>

        <div
          role="group"
          aria-label={`Daily sales for the last ${days} days. Window total ${formatPaise(windowTotalPaise)}.`}
          // At 360px twenty-one columns would be four pixels each. Below `md`
          // the columns keep a real width and the plot scrolls inside its own
          // box; the table underneath still carries every day in full.
          className="flex h-44 items-end gap-[3px] overflow-x-auto rounded-[var(--radius-md)] border border-border bg-bg-sunken px-2 pt-3 pb-2 md:overflow-x-visible"
        >
          {series.map((day) => {
            // Height is a layout ratio, not money — the rupee figure is never
            // derived from it. Floor at 2% so an empty day still has a target.
            const heightPercent =
              peakPaise > 0 ? Math.max(2, Math.round((day.totalPaise * 100) / peakPaise)) : 2;
            const active = selected?.dayKey === day.dayKey;
            return (
              <button
                key={day.dayKey}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedKey(day.dayKey)}
                title={`${day.fullLabel}: ${formatPaise(day.totalPaise)}`}
                aria-label={`${day.fullLabel}: ${formatPaise(day.totalPaise)} from ${day.billCount} bills`}
                className="group flex h-full w-7 shrink-0 cursor-pointer flex-col justify-end gap-1.5 rounded-[var(--radius-sm)] md:w-auto md:min-w-0 md:flex-1 md:shrink"
              >
                <span
                  aria-hidden="true"
                  style={{ height: `${heightPercent}%` }}
                  className={cn(
                    "w-full rounded-[3px]",
                    "transition-[background-color] duration-150 ease-[var(--ease-out-quart)]",
                    active
                      ? "bg-brand"
                      : day.totalPaise > 0
                        ? "bg-brand-border group-hover:bg-brand"
                        : "bg-border",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "numeric truncate text-[0.625rem] leading-none",
                    active ? "font-medium text-text" : "text-text-tertiary",
                  )}
                >
                  {day.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[var(--radius-md)] border border-border">
          <Table
            stickyHeader
            containerClassName="max-h-[15rem]"
            aria-label={`Daily sales table for the last ${days} days`}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead numeric>Bills</TableHead>
                <TableHead numeric>Units</TableHead>
                <TableHead numeric>Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series
                .slice()
                .reverse()
                .map((day) => (
                  <TableRow key={day.dayKey} selected={selected?.dayKey === day.dayKey}>
                    <TableCell className="whitespace-nowrap">
                      <span className="numeric">{day.label}</span>{" "}
                      <span className="text-text-tertiary">{day.weekday}</span>
                    </TableCell>
                    <TableCell numeric>{day.billCount}</TableCell>
                    <TableCell numeric>{day.unitCount}</TableCell>
                    <TableCell numeric className="font-medium">
                      {day.totalPaise > 0 ? formatPaiseTight(day.totalPaise) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
