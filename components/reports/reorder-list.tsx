"use client";

/**
 * The buy list. Everything at or below its reorder level, most urgent first.
 *
 * On-hand comes from `totalStockFor`, which excludes expired lots on purpose:
 * counting a dead lot as cover is exactly how a shop discovers a stock-out at
 * the counter instead of on this page.
 */

import * as React from "react";
import { ArrowDown } from "@phosphor-icons/react";
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
import {
  stockStateLabel,
  stockStateOf,
  stockStateTone,
  totalStockFor,
} from "@/lib/domain/selectors";
import type { Batch, Medicine, StockState } from "@/lib/domain/types";
import type { BadgeTone } from "@/components/ui";

/** Urgency order. OUT first, then how deep into the reorder level the SKU is. */
const STATE_RANK: Record<StockState, number> = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 };

interface ReorderRow {
  medicineId: string;
  name: string;
  generic: string;
  unitLabel: string;
  rackLocation: string;
  onHand: number;
  reorderLevel: number;
  state: StockState;
  suggested: number;
}

export interface ReorderListProps {
  medicines: Medicine[];
  batches: Batch[];
  now: Date;
}

export function ReorderList({ medicines, batches, now }: ReorderListProps) {
  const rows = React.useMemo<ReorderRow[]>(() => {
    const list: ReorderRow[] = [];
    for (const medicine of medicines) {
      if (!medicine.isActive) continue;
      const onHand = totalStockFor(medicine.id, batches, now);
      const state = stockStateOf(onHand, medicine.reorderLevel);
      if (state === "OK") continue;
      list.push({
        medicineId: medicine.id,
        name: medicine.name,
        generic: medicine.genericName,
        unitLabel: medicine.unitLabel,
        rackLocation: medicine.rackLocation,
        onHand,
        reorderLevel: medicine.reorderLevel,
        state,
        // Order back up to two reorder cycles: one to sell, one as cover.
        suggested: Math.max(1, medicine.reorderLevel * 2 - onHand),
      });
    }
    return list.sort((a, b) => {
      const byState = STATE_RANK[a.state] - STATE_RANK[b.state];
      if (byState !== 0) return byState;
      // Deeper below the line first. Compared as a cross-multiplied integer so
      // no ratio is ever held as a float.
      const byDepth = a.onHand * b.reorderLevel - b.onHand * a.reorderLevel;
      return byDepth !== 0 ? byDepth : a.name.localeCompare(b.name);
    });
  }, [medicines, batches, now]);

  const outCount = rows.filter((row) => row.state === "OUT").length;
  const suggestedUnits = rows.reduce((sum, row) => sum + row.suggested, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Reorder list</CardTitle>
        <CardDescription>
          {rows.length} SKUs at or below their reorder level, {outCount} of them already out.
          Suggested order totals {suggestedUnits} units.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {rows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<ArrowDown size={22} />}
            title="Nothing to order"
            description="Every active SKU is above its reorder level today."
          />
        ) : (
          <>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border md:hidden">
            {rows.map((row) => (
              <li key={row.medicineId} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] leading-tight font-medium text-text">{row.name}</p>
                  <p className="text-[0.75rem] leading-snug text-text-tertiary">
                    {row.generic} · rack <span className="numeric">{row.rackLocation}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-text-secondary">
                    <Badge size="sm" tone={stockStateTone(row.state) as BadgeTone} dot>
                      {stockStateLabel(row.state)}
                    </Badge>
                    <span>
                      on hand <span className="numeric text-text">{row.onHand}</span>
                    </span>
                    <span>
                      reorder at <span className="numeric">{row.reorderLevel}</span>
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="numeric text-[1.0625rem] font-medium text-text">{row.suggested}</p>
                  <p className="text-[0.6875rem] text-text-tertiary">{row.unitLabel} to order</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden rounded-[var(--radius-md)] border border-border md:block">
            <Table stickyHeader containerClassName="max-h-[24rem]" aria-label="Reorder list">
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead numeric>On hand</TableHead>
                  <TableHead numeric>Reorder at</TableHead>
                  <TableHead numeric>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.medicineId}>
                    <TableCell>
                      <span className="block font-medium text-text">{row.name}</span>
                      <span className="block text-[0.75rem] text-text-tertiary">
                        {row.generic} · rack {row.rackLocation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" tone={stockStateTone(row.state) as BadgeTone} dot>
                        {stockStateLabel(row.state)}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>{row.onHand}</TableCell>
                    <TableCell numeric className="text-text-secondary">
                      {row.reorderLevel}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {row.suggested}
                      <span className="ml-1 text-[0.6875rem] font-normal text-text-tertiary">
                        {row.unitLabel}
                      </span>
                    </TableCell>
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
