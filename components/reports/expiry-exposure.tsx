"use client";

/**
 * Money standing on the shelf with a clock on it.
 *
 * Value at risk is stated at COST, because that is what the shop actually loses
 * when a lot is written off — retail value was never earned. Cost is an
 * owner/pharmacist figure, so a cashier sees the same lots counted in units and
 * no rupee exposure at all.
 */

import * as React from "react";
import { Hourglass } from "@phosphor-icons/react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatPaise } from "@/lib/domain/money";
import { batchValuePaise, daysUntil } from "@/lib/domain/selectors";
import type { Batch, Medicine } from "@/lib/domain/types";
import type { BadgeTone } from "@/components/ui";

interface Bucket {
  id: string;
  label: string;
  maxDays: number;
  tone: BadgeTone;
  batchCount: number;
  units: number;
  valuePaise: number;
}

interface ExposureRow {
  batchId: string;
  name: string;
  batchNumber: string;
  expiryDate: string;
  days: number;
  quantity: number;
  valuePaise: number;
  bucketId: string;
  tone: BadgeTone;
}

const BUCKET_SPECS: Array<{ id: string; label: string; maxDays: number; tone: BadgeTone }> = [
  { id: "d30", label: "Within 30 days", maxDays: 30, tone: "danger" },
  { id: "d60", label: "31 to 60 days", maxDays: 60, tone: "warning" },
  { id: "d90", label: "61 to 90 days", maxDays: 90, tone: "accent" },
];

const EXPIRY_DATE = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export interface ExpiryExposureProps {
  medicines: Medicine[];
  batches: Batch[];
  now: Date;
  canSeeCost: boolean;
}

export function ExpiryExposure({ medicines, batches, now, canSeeCost }: ExpiryExposureProps) {
  const { buckets, rows } = React.useMemo(() => {
    const nameById = new Map(medicines.map((m) => [m.id, m.name]));
    const acc: Bucket[] = BUCKET_SPECS.map((spec) => ({
      ...spec,
      batchCount: 0,
      units: 0,
      valuePaise: 0,
    }));
    const list: ExposureRow[] = [];

    for (const batch of batches) {
      if (batch.quantity <= 0) continue;
      const days = daysUntil(batch.expiryDate, now);
      // Already expired lots belong to the write-off view, not to exposure.
      if (Number.isNaN(days) || days < 0 || days > 90) continue;

      const spec = BUCKET_SPECS.find((b) => days <= b.maxDays) ?? BUCKET_SPECS[2];
      const bucket = acc.find((b) => b.id === spec.id);
      const value = batchValuePaise(batch);
      if (bucket) {
        bucket.batchCount += 1;
        bucket.units += batch.quantity;
        bucket.valuePaise += value;
      }
      list.push({
        batchId: batch.id,
        name: nameById.get(batch.medicineId) ?? batch.medicineId,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        days,
        quantity: batch.quantity,
        valuePaise: value,
        bucketId: spec.id,
        tone: spec.tone,
      });
    }

    list.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
    return { buckets: acc, rows: list };
  }, [medicines, batches, now]);

  const totalUnits = buckets.reduce((sum, b) => sum + b.units, 0);
  const totalValuePaise = buckets.reduce((sum, b) => sum + b.valuePaise, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Expiry exposure</CardTitle>
        <CardDescription>
          {canSeeCost ? (
            <>
              {formatPaise(totalValuePaise)} of stock at cost, across {totalUnits} units, dies
              inside 90 days. Sell it, return it, or write it off.
            </>
          ) : (
            <>
              {totalUnits} units across {rows.length} lots die inside 90 days. Cost value is an
              owner figure and is hidden in this session.
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.75rem] text-text-secondary">{bucket.label}</span>
                <Badge size="sm" tone={bucket.tone}>
                  {bucket.batchCount} lots
                </Badge>
              </div>
              <p className="numeric mt-1.5 text-[1.0625rem] font-medium text-text">
                {canSeeCost ? formatPaise(bucket.valuePaise) : `${bucket.units} units`}
              </p>
              <p className="text-[0.75rem] text-text-tertiary">
                {canSeeCost ? (
                  <>
                    <span className="numeric">{bucket.units}</span> units at cost
                  </>
                ) : (
                  <>
                    across <span className="numeric">{bucket.batchCount}</span> lots
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Hourglass size={22} />}
            title="Nothing expiring inside 90 days"
            description="Every lot on hand has more than a quarter of shelf life left."
          />
        ) : (
          <>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border md:hidden">
            {rows.map((row) => (
              <li key={row.batchId} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] leading-tight font-medium text-text">{row.name}</p>
                  <p className="numeric text-[0.75rem] leading-snug text-text-tertiary">
                    batch {row.batchNumber} · {EXPIRY_DATE.format(new Date(row.expiryDate))}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge size="sm" tone={row.tone}>
                      {row.days}d left
                    </Badge>
                    <span className="text-[0.75rem] text-text-secondary">
                      <span className="numeric">{row.quantity}</span> units
                    </span>
                  </div>
                </div>
                {canSeeCost ? (
                  <p className="numeric shrink-0 text-[0.9375rem] font-medium text-text">
                    {formatPaise(row.valuePaise)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden rounded-[var(--radius-md)] border border-border md:block">
            <Table
              stickyHeader
              containerClassName="max-h-[20rem]"
              aria-label="Batches expiring within 90 days"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead numeric>Expires</TableHead>
                  <TableHead numeric>Days</TableHead>
                  <TableHead numeric>Units</TableHead>
                  {canSeeCost ? <TableHead numeric>At cost</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.batchId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="numeric text-[0.75rem] text-text-secondary">
                      {row.batchNumber}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {EXPIRY_DATE.format(new Date(row.expiryDate))}
                    </TableCell>
                    <TableCell numeric>
                      <Badge size="sm" tone={row.tone}>
                        {row.days}d
                      </Badge>
                    </TableCell>
                    <TableCell numeric>{row.quantity}</TableCell>
                    {canSeeCost ? (
                      <TableCell numeric className="font-medium">
                        {formatPaise(row.valuePaise)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
