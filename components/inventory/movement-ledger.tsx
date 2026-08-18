"use client";

/**
 * The audit trail for one medicine, newest first.
 *
 * `StockMovement` is append-only and `balanceAfter` is stamped on every row, so
 * this table can be read straight down to see how a lot got to its current count
 * without replaying anything. Signed quantities are colour-coded by direction:
 * stock in reads as success, stock out as danger, and the sign is always printed
 * so the colour is never the only cue.
 */

import * as React from "react";

import {
  Badge,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { movementLabel } from "@/lib/domain/selectors";
import type { Batch, Bill, MovementType, StockMovement, Staff } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { EMPTY_CELL, formatDateTime, toBadgeTone } from "./shared";

/** Tone per movement type. Money-in green, stock-out red, corrections neutral. */
const MOVEMENT_TONE: Record<MovementType, string> = {
  PURCHASE: "success",
  SALE: "neutral",
  SALE_REVERSAL: "accent",
  ADJUSTMENT: "warning",
  EXPIRY_WRITE_OFF: "danger",
  DAMAGE: "danger",
  RETURN_TO_SUPPLIER: "accent",
};

export interface MovementLedgerProps {
  movements: StockMovement[];
  batches: Batch[];
  staff: Staff[];
  bills: Bill[];
}

export function MovementLedger({ movements, batches, staff, bills }: MovementLedgerProps) {
  const batchNumberById = React.useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch.batchNumber])),
    [batches],
  );
  // Sales carry a bill id, not a reason. The invoice number is what the operator
  // can actually look up, so that is what the ledger prints.
  const billNumberById = React.useMemo(
    () => new Map(bills.map((bill) => [bill.id, bill.billNumber])),
    [bills],
  );
  const staffById = React.useMemo(
    () => new Map(staff.map((member) => [member.id, member.name])),
    [staff],
  );

  if (movements.length === 0) {
    return (
      <EmptyState
        size="sm"
        title="No stock has moved yet"
        description="Receiving a batch, selling a strip or correcting a count all land here, in the order they happened."
      />
    );
  }

  return (
    <>
      {/* Below `md` the ledger reads as a stack. Every row still prints its
          sign, its balance after and who wrote it, so the audit trail is not
          abbreviated on a phone. */}
      <ul className="divide-y divide-border md:hidden">
        {movements.map((movement) => (
          <li key={movement.id} className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge size="sm" tone={toBadgeTone(MOVEMENT_TONE[movement.type])}>
                {movementLabel(movement.type)}
              </Badge>
              <span className="numeric text-[0.75rem] text-text-tertiary">
                {formatDateTime(movement.createdAt)}
              </span>
              <span
                className={cn(
                  "numeric ml-auto text-[0.9375rem] font-medium",
                  movement.quantity > 0 ? "text-success-text" : "text-danger-text",
                )}
              >
                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
              </span>
            </div>

            <p className="mt-1.5 text-[0.8125rem] text-text-secondary">
              batch{" "}
              <span className="numeric text-text">
                {batchNumberById.get(movement.batchId) ?? EMPTY_CELL}
              </span>{" "}
              · balance after{" "}
              <span className="numeric text-text">{movement.balanceAfter}</span>
            </p>

            <p className="mt-0.5 text-[0.8125rem] leading-snug text-text-secondary">
              {movement.reason ??
                (movement.billId
                  ? `Bill ${billNumberById.get(movement.billId) ?? movement.billId}`
                  : EMPTY_CELL)}
              {movement.staffId ? (
                <span className="text-text-tertiary">
                  {" "}
                  · {staffById.get(movement.staffId) ?? EMPTY_CELL}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
    <Table containerClassName="max-h-[28rem]" stickyHeader>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead numeric>Change</TableHead>
          <TableHead numeric>Balance after</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>By</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody className="contain-rows">
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell className="numeric whitespace-nowrap text-xs text-text-secondary">
              {formatDateTime(movement.createdAt)}
            </TableCell>

            <TableCell>
              <Badge size="sm" tone={toBadgeTone(MOVEMENT_TONE[movement.type])}>
                {movementLabel(movement.type)}
              </Badge>
            </TableCell>

            <TableCell className="numeric text-xs text-text-secondary">
              {batchNumberById.get(movement.batchId) ?? EMPTY_CELL}
            </TableCell>

            <TableCell
              numeric
              className={cn(
                "font-medium",
                movement.quantity > 0 ? "text-success-text" : "text-danger-text",
              )}
            >
              {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
            </TableCell>

            <TableCell numeric>{movement.balanceAfter}</TableCell>

            <TableCell className="max-w-[20rem] truncate text-xs text-text-secondary">
              {movement.reason ??
                (movement.billId
                  ? `Bill ${billNumberById.get(movement.billId) ?? movement.billId}`
                  : EMPTY_CELL)}
            </TableCell>

            <TableCell className="text-xs text-text-secondary">
              {movement.staffId ? (staffById.get(movement.staffId) ?? EMPTY_CELL) : EMPTY_CELL}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
      </div>
    </>
  );
}
