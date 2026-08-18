"use client";

/**
 * Every lot of one medicine, sorted FEFO — earliest expiry first, which is the
 * order they will actually leave the shelf.
 *
 * An expired lot is rendered on the danger ground with an EXPIRED badge and its
 * quantity struck through: those units are physically present, are worth money on
 * the write-off report, and are not stock. Anything less than unmistakable here
 * is how expired medicine reaches a customer.
 */

import * as React from "react";
import { Prohibit, Sliders } from "@phosphor-icons/react";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatBps, formatPaiseTight } from "@/lib/domain/money";
import { isExpired, marginBpsOf } from "@/lib/domain/selectors";
import type { Batch, Supplier } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import {
  EMPTY_CELL,
  ExpiryBadge,
  expiryStateFor,
  formatDaysLeft,
  formatDay,
} from "./shared";

export interface BatchTableProps {
  batches: Batch[];
  suppliers: Supplier[];
  warningDays: number;
  now: Date;
  canSeeCost: boolean;
  onAdjust: (batch: Batch) => void;
  onWriteOff: (batch: Batch) => void;
}

export function BatchTable({
  batches,
  suppliers,
  warningDays,
  now,
  canSeeCost,
  onAdjust,
  onWriteOff,
}: BatchTableProps) {
  const supplierById = React.useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );

  return (
    <>
      {/* Below `md` each lot is a card. The expired treatment carries over
          intact: danger ground, EXPIRED badge, quantity struck through. */}
      <ul className="divide-y divide-border md:hidden">
        {batches.map((batch) => {
          const expired = isExpired(batch, now);
          const state = expiryStateFor(batch.expiryDate, now, warningDays);
          const supplier = batch.supplierId ? supplierById.get(batch.supplierId) : undefined;
          const margin = marginBpsOf(batch);

          return (
            <li key={batch.id} className={cn("px-3 py-3", expired && "bg-danger-subtle")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="numeric text-[0.9375rem] font-medium text-text">
                  {batch.batchNumber}
                </span>
                <ExpiryBadge state={state} />
                <span
                  className={cn(
                    "numeric ml-auto text-[0.8125rem]",
                    expired ? "font-medium text-danger-text" : "text-text-secondary",
                  )}
                >
                  {formatDay(batch.expiryDate)}
                </span>
              </div>

              <p className="mt-0.5 text-[0.75rem] text-text-tertiary">
                {formatDaysLeft(batch.expiryDate, now)}
              </p>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
                <div>
                  <dt className="text-[0.75rem] text-text-tertiary">On hand</dt>
                  <dd className={cn("numeric font-medium", expired && "text-danger-text line-through")}>
                    {batch.quantity}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.75rem] text-text-tertiary">MRP</dt>
                  <dd className="numeric text-text">{formatPaiseTight(batch.mrpPaise)}</dd>
                </div>
                <div>
                  <dt className="text-[0.75rem] text-text-tertiary">Selling</dt>
                  <dd className="numeric text-text">{formatPaiseTight(batch.sellingPaise)}</dd>
                </div>
                {canSeeCost ? (
                  <div>
                    <dt className="text-[0.75rem] text-text-tertiary">Cost / margin</dt>
                    <dd className="numeric text-text-secondary">
                      {formatPaiseTight(batch.costPaise)}{" "}
                      <span className={cn(margin < 0 && "text-danger-text")}>
                        · {formatBps(margin)}
                      </span>
                    </dd>
                  </div>
                ) : null}
                <div className="col-span-2">
                  <dt className="text-[0.75rem] text-text-tertiary">Supplier</dt>
                  <dd className="text-text-secondary">
                    {supplier?.name ?? EMPTY_CELL}
                    {batch.invoiceRef ? (
                      <span className="numeric block text-[0.75rem] text-text-tertiary">
                        {batch.invoiceRef} · received {formatDay(batch.receivedAt)}
                      </span>
                    ) : (
                      <span className="numeric block text-[0.75rem] text-text-tertiary">
                        received {formatDay(batch.receivedAt)}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {expired && batch.quantity > 0 ? (
                  <Button
                    variant="danger"
                    className="h-11 flex-1"
                    leftIcon={<Prohibit size={15} weight="bold" />}
                    onClick={() => onWriteOff(batch)}
                  >
                    Write off
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="h-11 flex-1"
                  leftIcon={<Sliders size={15} />}
                  onClick={() => onAdjust(batch)}
                >
                  Adjust
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
    <Table containerClassName="max-h-[32rem]" stickyHeader>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead numeric>Qty</TableHead>
          <TableHead numeric>MRP</TableHead>
          <TableHead numeric>Selling</TableHead>
          {canSeeCost ? <TableHead numeric>Cost</TableHead> : null}
          {canSeeCost ? <TableHead numeric>Margin</TableHead> : null}
          <TableHead>Supplier</TableHead>
          <TableHead className="hidden 2xl:table-cell">Received</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {batches.map((batch) => {
          const expired = isExpired(batch, now);
          const state = expiryStateFor(batch.expiryDate, now, warningDays);
          const supplier = batch.supplierId ? supplierById.get(batch.supplierId) : undefined;
          const margin = marginBpsOf(batch);

          return (
            <TableRow
              key={batch.id}
              className={cn(expired && "bg-danger-subtle hover:bg-danger-subtle")}
            >
              <TableCell className="numeric font-medium">{batch.batchNumber}</TableCell>

              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "numeric text-xs",
                      expired ? "font-medium text-danger-text" : "text-text-secondary",
                    )}
                  >
                    {formatDay(batch.expiryDate)}
                  </span>
                  <ExpiryBadge state={state} />
                  <span className="hidden text-[0.6875rem] text-text-tertiary 2xl:inline">
                    {formatDaysLeft(batch.expiryDate, now)}
                  </span>
                </span>
              </TableCell>

              <TableCell numeric className="font-medium">
                <span className={cn(expired && "text-danger-text line-through")}>
                  {batch.quantity}
                </span>
              </TableCell>

              <TableCell numeric>{formatPaiseTight(batch.mrpPaise)}</TableCell>
              <TableCell numeric>{formatPaiseTight(batch.sellingPaise)}</TableCell>

              {canSeeCost ? (
                <TableCell numeric className="text-text-secondary">
                  {formatPaiseTight(batch.costPaise)}
                </TableCell>
              ) : null}

              {canSeeCost ? (
                <TableCell numeric className={cn(margin < 0 && "text-danger-text")}>
                  {formatBps(margin)}
                </TableCell>
              ) : null}

              <TableCell className="max-w-[10rem] truncate text-xs text-text-secondary">
                {supplier?.name ?? EMPTY_CELL}
                {batch.invoiceRef ? (
                  <span className="numeric block text-[0.6875rem] text-text-tertiary">
                    {batch.invoiceRef}
                  </span>
                ) : null}
              </TableCell>

              <TableCell className="numeric hidden text-xs text-text-secondary 2xl:table-cell">
                {formatDay(batch.receivedAt)}
              </TableCell>

              <TableCell className="text-right whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {expired && batch.quantity > 0 ? (
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<Prohibit size={13} weight="bold" />}
                      onClick={() => onWriteOff(batch)}
                    >
                      Write off
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Sliders size={13} />}
                    onClick={() => onAdjust(batch)}
                  >
                    Adjust
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
      </div>
    </>
  );
}
