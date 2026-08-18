"use client";

/**
 * What actually moves. Aggregated from `BillItem` rows rather than from the
 * catalogue, because the snapshot on the line is the historical truth: a SKU
 * renamed or re-priced last week must not rewrite what it sold for.
 */

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Segmented,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatPaise } from "@/lib/domain/money";
import type { Bill } from "@/lib/domain/types";

type Metric = "revenue" | "units";

interface SellerRow {
  medicineId: string;
  name: string;
  generic: string;
  unitLabel: string;
  units: number;
  revenuePaise: number;
}

export interface TopSellersProps {
  bills: Bill[];
  /** How many rows to print. */
  limit?: number;
}

export function TopSellers({ bills, limit = 8 }: TopSellersProps) {
  const [metric, setMetric] = React.useState<Metric>("revenue");

  const rows = React.useMemo(() => {
    const byMedicine = new Map<string, SellerRow>();
    for (const bill of bills) {
      if (bill.status !== "PAID") continue;
      for (const item of bill.items) {
        const row = byMedicine.get(item.medicineId) ?? {
          medicineId: item.medicineId,
          name: item.nameSnapshot,
          generic: item.genericSnapshot,
          unitLabel: item.unitLabel,
          units: 0,
          revenuePaise: 0,
        };
        row.units += item.quantity;
        row.revenuePaise += item.lineTotalPaise;
        byMedicine.set(item.medicineId, row);
      }
    }
    return Array.from(byMedicine.values());
  }, [bills]);

  const ranked = React.useMemo(() => {
    const sorted = rows.slice().sort((a, b) => {
      const primary =
        metric === "revenue" ? b.revenuePaise - a.revenuePaise : b.units - a.units;
      return primary !== 0 ? primary : a.name.localeCompare(b.name);
    });
    return sorted.slice(0, limit);
  }, [rows, metric, limit]);

  const windowRevenuePaise = rows.reduce((sum, row) => sum + row.revenuePaise, 0);
  const topRevenuePaise = ranked.reduce((sum, row) => sum + row.revenuePaise, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Top sellers</CardTitle>
            <CardDescription>
              These {ranked.length} SKUs carry {formatPaise(topRevenuePaise)} of{" "}
              {formatPaise(windowRevenuePaise)} billed in the window.
            </CardDescription>
          </div>
          <Segmented<Metric>
            aria-label="Rank top sellers by"
            size="sm"
            value={metric}
            onValueChange={setMetric}
            options={[
              { value: "revenue", label: "By revenue" },
              { value: "units", label: "By units" },
            ]}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {ranked.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing sold in this window"
            description="Ring up a bill at the counter and it will rank here."
          />
        ) : (
          <div className="rounded-[var(--radius-md)] border border-border">
            <Table aria-label={`Top sellers by ${metric}`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" numeric>
                    #
                  </TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead numeric>Units</TableHead>
                  <TableHead numeric>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((row, index) => (
                  <TableRow key={row.medicineId}>
                    <TableCell numeric className="text-text-tertiary">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-text">{row.name}</span>
                      <span className="block text-[0.75rem] text-text-tertiary">
                        {row.generic}
                      </span>
                    </TableCell>
                    <TableCell numeric>{row.units}</TableCell>
                    <TableCell numeric className="font-medium">
                      {formatPaise(row.revenuePaise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
