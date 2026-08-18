"use client";

import * as React from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatPaise } from "@/lib/domain/money";
import type { Bill, Payment, StockMovement } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function MoneyRow({
  label,
  hint,
  value,
  tone = "default",
  emphasis = false,
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: "default" | "danger" | "success";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <span
          className={cn(
            "text-[0.8125rem]",
            emphasis ? "font-medium text-text" : "text-text-secondary",
          )}
        >
          {label}
        </span>
        {hint ? (
          <p className="text-[0.6875rem] leading-snug text-text-tertiary">{hint}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "numeric shrink-0",
          emphasis ? "text-[1.0625rem] font-medium" : "text-[0.875rem]",
          tone === "danger"
            ? "text-danger-text"
            : tone === "success"
              ? "text-success-text"
              : "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface SettledSummaryProps {
  bill: Bill;
  /** Absent for a cash sale: no gateway is involved, so there is no cut. */
  payment: Payment | null;
  movements: StockMovement[];
  /** Cash only. Already computed in paise by the caller. */
  changePaise?: number | null;
}

/**
 * What actually happened, in the order it happened.
 *
 * Money first, because that is what the customer is waiting on, then the stock
 * ledger, because that is the part every other pharmacy tool leaves for the
 * owner to reconcile by hand at closing. A sale that does not settle its own
 * stock is a sale you have to count twice.
 */
export function SettledSummary({
  bill,
  payment,
  movements,
  changePaise = null,
}: SettledSummaryProps) {
  const itemByBatch = React.useMemo(
    () => new Map(bill.items.map((item) => [item.batchId, item])),
    [bill.items],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-success-border bg-success-subtle p-3.5">
        <CheckCircle
          size={19}
          weight="fill"
          aria-hidden="true"
          className="mt-px shrink-0 text-success-text"
        />
        <div className="min-w-0">
          <p className="text-[0.875rem] font-medium text-success-text">
            {payment ? "Payment captured" : "Cash received"}
          </p>
          <p className="text-[0.75rem] text-success-text opacity-90">
            {bill.billNumber}
            {bill.paidAt ? ` · ${new Date(bill.paidAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <span className="numeric ml-auto shrink-0 text-[1.375rem] leading-none font-light text-success-text">
          {formatPaise(payment ? payment.amountPaise : bill.payablePaise)}
        </span>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3.5 py-2">
        {payment ? (
          <>
            <MoneyRow label="Captured by the gateway" value={formatPaise(payment.amountPaise)} />
            <MoneyRow
              label="Gateway fee deducted"
              hint="the cut is taken from what was captured, not from what the shop wanted"
              value={`- ${formatPaise(payment.gatewayFeePaise)}`}
              tone="danger"
            />
            <div className="border-t border-border pt-1">
              <MoneyRow
                label="Net to the shop"
                hint={`bill total ${formatPaise(bill.totalPaise)}`}
                value={formatPaise(payment.netPaise)}
                tone="success"
                emphasis
              />
            </div>
          </>
        ) : (
          <>
            <MoneyRow label="Bill total" value={formatPaise(bill.totalPaise)} />
            {changePaise !== null && changePaise > 0 ? (
              <MoneyRow label="Change handed back" value={formatPaise(changePaise)} />
            ) : null}
            <div className="border-t border-border pt-1">
              <MoneyRow
                label="Net to the shop"
                hint="cash carries no gateway cut"
                value={formatPaise(bill.totalPaise)}
                tone="success"
                emphasis
              />
            </div>
          </>
        )}
      </div>

      <div>
        <p className="mb-2 text-[0.8125rem] font-medium text-text">
          Stock movements written{" "}
          <span className="font-normal text-text-tertiary">
            ({movements.length} {movements.length === 1 ? "line" : "lines"})
          </span>
        </p>

        {movements.length === 0 ? (
          <p className="text-[0.75rem] text-text-secondary">
            No lots were decremented. The ledger already carried this bill.
          </p>
        ) : (
          <>
          {/* Below `md` each decrement is a line of its own. The ledger is the
              part an accountant reads, so it must not need a sideways drag. */}
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border md:hidden">
            {movements.map((movement) => {
              const item = itemByBatch.get(movement.batchId);
              const before = movement.balanceAfter - movement.quantity;
              return (
                <li key={movement.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] leading-tight font-medium text-text">
                        {item?.nameSnapshot ?? movement.medicineId}
                      </p>
                      <p className="numeric text-[0.75rem] text-text-tertiary">
                        batch {item?.batchNumberSnapshot ?? movement.batchId}
                      </p>
                    </div>
                    <span className="numeric shrink-0 text-[0.9375rem] font-medium text-danger-text">
                      {movement.quantity}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-text-secondary">
                    on hand <span className="numeric text-text-tertiary">{before}</span>
                    <ArrowRight size={11} weight="bold" aria-hidden="true" className="text-text-tertiary" />
                    <span className="numeric font-medium text-text">{movement.balanceAfter}</span>
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead numeric>Sold</TableHead>
                  <TableHead numeric>On hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const item = itemByBatch.get(movement.batchId);
                  // balanceAfter = before + quantity, and quantity is signed
                  // negative for a sale. No rounding, no rupees: this is the
                  // ledger's own arithmetic read back out.
                  const before = movement.balanceAfter - movement.quantity;
                  return (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <span className="font-medium text-text">
                          {item?.nameSnapshot ?? movement.medicineId}
                        </span>
                        {item ? (
                          <p className="truncate text-[0.6875rem] text-text-secondary">
                            {item.genericSnapshot}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="numeric text-[0.8125rem]">
                          {item?.batchNumberSnapshot ?? movement.batchId}
                        </span>
                      </TableCell>
                      <TableCell numeric>
                        <span className="text-danger-text">{movement.quantity}</span>
                      </TableCell>
                      <TableCell numeric>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-text-tertiary">{before}</span>
                          <ArrowRight
                            size={11}
                            weight="bold"
                            aria-hidden="true"
                            className="text-text-tertiary"
                          />
                          <span className="font-medium text-text">{movement.balanceAfter}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
