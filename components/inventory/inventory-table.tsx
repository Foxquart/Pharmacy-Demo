"use client";

/**
 * The inventory worklist. Dense on purpose: 36px rows, no card chrome inside the
 * grid, every number right-aligned and tabular so a column of quantities can be
 * scanned down rather than read across.
 *
 * Cost and margin columns are not rendered at all for a CASHIER. Hiding them with
 * CSS would still ship the purchase price to the counter screen.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatBps, formatPaiseTight } from "@/lib/domain/money";
import type { ExpiryState, Medicine, StockState } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import {
  EMPTY_CELL,
  ExpiryBadge,
  ScheduleBadge,
  StockBadge,
  formatDay,
  pluralUnit,
  toBadgeTone,
} from "./shared";
import { Badge } from "@/components/ui";

/** One row of the worklist, pre-computed so the table itself does no arithmetic. */
export interface MedicineRow {
  medicine: Medicine;
  categoryName: string;
  categoryTone: string;
  /** Sellable units on hand. Excludes expired lots, via `totalStockFor`. */
  onHand: number;
  stockState: StockState;
  /** Earliest expiry among lots still physically on the shelf. */
  earliestExpiry: string | null;
  expiryState: ExpiryState | null;
  /** Days to the earliest lot that has NOT expired yet. null when there is none. */
  daysToNextExpiry: number | null;
  /** Units sitting on the shelf past their expiry date. Never sellable. */
  expiredUnits: number;
  /** Priced off the lot that would actually be sold next (FEFO). */
  mrpPaise: number | null;
  costPaise: number | null;
  marginBps: number | null;
}

export interface InventoryTableProps {
  rows: MedicineRow[];
  canSeeCost: boolean;
}

export function InventoryTable({ rows, canSeeCost }: InventoryTableProps) {
  return (
    <>
      {/* Below `md` the worklist unwinds into one card per SKU. A ten column
          grid on a 360px screen is either a sideways scroll or a lie, and a
          pharmacist checking stock on a phone needs the name, the count and the
          expiry to be legible at a glance. */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <InventoryCard key={row.medicine.id} row={row} canSeeCost={canSeeCost} />
        ))}
      </ul>

      <div className="hidden md:block">
        <InventoryGrid rows={rows} canSeeCost={canSeeCost} />
      </div>
    </>
  );
}

function InventoryCard({ row, canSeeCost }: { row: MedicineRow; canSeeCost: boolean }) {
  const { medicine } = row;

  return (
    <li className={cn(row.stockState === "OUT" && "bg-danger-subtle/40")}>
      <Link
        href={`/inventory/${medicine.id}`}
        className={cn(
          "flex min-h-11 items-start gap-3 px-3 py-3",
          "transition-colors duration-150 ease-[var(--ease-out-quart)] active:bg-surface-active",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[0.9375rem] leading-tight font-medium text-text">
              {medicine.name}
            </span>
            <ScheduleBadge schedule={medicine.schedule} />
          </div>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-text-secondary">
            {medicine.genericName}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge size="sm" tone={toBadgeTone(row.categoryTone)}>
              {row.categoryName}
            </Badge>
            <StockBadge state={row.stockState} />
            {row.earliestExpiry && row.expiryState ? <ExpiryBadge state={row.expiryState} /> : null}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8125rem]">
            <span className="text-text">
              <span className="numeric font-medium">{row.onHand}</span>{" "}
              <span className="text-text-tertiary">
                {pluralUnit(row.onHand, medicine.unitLabel)} on hand
              </span>
            </span>
            <span className="text-text-secondary">
              MRP{" "}
              <span className="numeric text-text">
                {row.mrpPaise === null ? EMPTY_CELL : formatPaiseTight(row.mrpPaise)}
              </span>
            </span>
            {canSeeCost && row.marginBps !== null ? (
              <span className="text-text-secondary">
                margin{" "}
                <span
                  className={cn("numeric", row.marginBps < 0 ? "text-danger-text" : "text-text")}
                >
                  {formatBps(row.marginBps)}
                </span>
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-[0.75rem] text-text-tertiary">
            {row.earliestExpiry ? (
              <>
                earliest expiry <span className="numeric">{formatDay(row.earliestExpiry)}</span>
              </>
            ) : (
              "No lots on shelf"
            )}{" "}
            · rack <span className="numeric">{medicine.rackLocation}</span>
          </p>
        </div>

        <CaretRight
          size={15}
          weight="bold"
          aria-hidden="true"
          className="mt-1 shrink-0 text-text-tertiary"
        />
      </Link>
    </li>
  );
}

function InventoryGrid({ rows, canSeeCost }: InventoryTableProps) {
  return (
    <Table stickyHeader containerClassName="max-h-[calc(100dvh-19rem)]">
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[15rem]">Medicine</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Rack</TableHead>
          <TableHead numeric>On hand</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Earliest expiry</TableHead>
          <TableHead numeric>MRP</TableHead>
          {canSeeCost ? <TableHead numeric>Cost</TableHead> : null}
          {canSeeCost ? <TableHead numeric>Margin</TableHead> : null}
          <TableHead className="w-8" aria-label="Open" />
        </TableRow>
      </TableHeader>

      <TableBody className="contain-rows">
        {rows.map((row) => (
          <InventoryRow key={row.medicine.id} row={row} canSeeCost={canSeeCost} />
        ))}
      </TableBody>
    </Table>
  );
}

function InventoryRow({ row, canSeeCost }: { row: MedicineRow; canSeeCost: boolean }) {
  const router = useRouter();
  const { medicine } = row;
  const href = `/inventory/${medicine.id}`;

  return (
    <TableRow
      interactive
      onClick={() => router.push(href)}
      className={cn(row.stockState === "OUT" && "bg-danger-subtle/40")}
    >
      <TableCell className="py-1.5">
        {/* A real link, not just a row handler: the medicine has to be reachable
            by keyboard and openable in a new tab. */}
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="block rounded-[var(--radius-sm)] leading-tight"
        >
          <span className="block truncate font-medium text-text">{medicine.name}</span>
          <span className="block truncate text-xs text-text-tertiary">
            {medicine.genericName}
          </span>
        </Link>
      </TableCell>

      <TableCell>
        <Badge size="sm" tone={toBadgeTone(row.categoryTone)}>
          {row.categoryName}
        </Badge>
      </TableCell>

      <TableCell>
        <ScheduleBadge schedule={medicine.schedule} />
      </TableCell>

      <TableCell className="numeric text-xs text-text-secondary">
        {medicine.rackLocation}
      </TableCell>

      <TableCell numeric className="font-medium">
        {row.onHand}
        <span className="ml-1 text-[0.6875rem] font-normal text-text-tertiary">
          {pluralUnit(row.onHand, medicine.unitLabel)}
        </span>
      </TableCell>

      <TableCell>
        <StockBadge state={row.stockState} />
      </TableCell>

      <TableCell>
        {row.earliestExpiry && row.expiryState ? (
          <span className="flex items-center gap-2">
            <span className="numeric text-xs text-text-secondary">
              {formatDay(row.earliestExpiry)}
            </span>
            <ExpiryBadge state={row.expiryState} />
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">No lots on shelf</span>
        )}
      </TableCell>

      <TableCell numeric>
        {row.mrpPaise === null ? EMPTY_CELL : formatPaiseTight(row.mrpPaise)}
      </TableCell>

      {canSeeCost ? (
        <TableCell numeric className="text-text-secondary">
          {row.costPaise === null ? EMPTY_CELL : formatPaiseTight(row.costPaise)}
        </TableCell>
      ) : null}

      {canSeeCost ? (
        <TableCell numeric className={cn(row.marginBps !== null && row.marginBps < 0 && "text-danger-text")}>
          {row.marginBps === null ? EMPTY_CELL : formatBps(row.marginBps)}
        </TableCell>
      ) : null}

      <TableCell className="w-8 text-text-tertiary">
        <CaretRight size={13} weight="bold" aria-hidden="true" />
      </TableCell>
    </TableRow>
  );
}
