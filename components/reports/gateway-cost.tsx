"use client";

/**
 * What the payment gateway costs, and what that costs in a year.
 *
 * This is the number the fee policy on /settings exists to control, so the card
 * links straight to it and states the policy currently in force.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { computeFees, formatBps, formatPaise } from "@/lib/domain/money";
import type { Bill, FeeConfig, Payment } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<FeeConfig["mode"], string> = {
  ABSORB: "Absorb",
  PASS_TO_CUSTOMER: "Pass to customer",
  SPLIT: "Split",
};

/** Scale a paise figure from `days` of trading to a full year. Integer in,
 *  integer out — the annual figure is still an exact count of paise. */
function annualise(paise: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round((paise * 365) / days);
}

function Line({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-text-secondary">{label}</p>
        {hint ? <p className="text-[0.75rem] text-text-tertiary">{hint}</p> : null}
      </div>
      <p
        className={cn(
          "numeric shrink-0 text-[0.9375rem] font-medium",
          tone === "success" && "text-success-text",
          tone === "danger" && "text-danger-text",
          tone === "neutral" && "text-text",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export interface GatewayCostProps {
  bills: Bill[];
  payments: Payment[];
  feeConfig: FeeConfig;
  days: number;
}

export function GatewayCost({ bills, payments, feeConfig, days }: GatewayCostProps) {
  const totals = React.useMemo(() => {
    const settledBillIds = new Set(
      bills.filter((bill) => bill.status === "PAID").map((bill) => bill.id),
    );

    let capturedPaise = 0;
    let feesPaise = 0;
    let count = 0;
    for (const payment of payments) {
      if (payment.status !== "PAID" || !settledBillIds.has(payment.billId)) continue;
      capturedPaise += payment.amountPaise;
      feesPaise += payment.gatewayFeePaise;
      count += 1;
    }

    let recoveredPaise = 0;
    for (const bill of bills) {
      if (bill.status !== "PAID") continue;
      recoveredPaise += bill.convenienceFeePaise;
    }

    return { capturedPaise, feesPaise, recoveredPaise, count };
  }, [bills, payments]);

  const bornePaise = totals.feesPaise - totals.recoveredPaise;
  const shopIsCovered = bornePaise <= 0;

  // The all-in rate is derived by `computeFees`, never re-derived here. It does
  // not depend on the amount, so any total answers the question.
  const effectiveRateBps = React.useMemo(
    () => computeFees(0, feeConfig).effectiveRateBps,
    [feeConfig],
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Gateway fee cost</CardTitle>
        <CardDescription>
          {totals.count} UPI settlements over {days} days. The gateway charges{" "}
          {formatBps(feeConfig.percentBps)} plus {formatBps(feeConfig.gstOnFeeBps)} GST on that
          fee, an all-in {formatBps(effectiveRateBps)}.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="divide-y divide-border">
          <Line
            label="Captured through the gateway"
            hint={`${totals.count} payments`}
            value={formatPaise(totals.capturedPaise)}
          />
          <Line
            label="Gateway fees paid"
            hint={`Over ${days} days`}
            value={formatPaise(totals.feesPaise)}
            tone="danger"
          />
          <Line
            label="Recovered as convenience fee"
            hint={`Policy: ${MODE_LABEL[feeConfig.mode]}`}
            value={formatPaise(totals.recoveredPaise)}
            tone="success"
          />
          <Line
            label={shopIsCovered ? "Net position, shop ahead" : "Net cost to the shop"}
            hint={
              shopIsCovered
                ? "The gross-up covers the cut, so the shop keeps its full bill total."
                : "The shop is eating this share of every UPI sale."
            }
            value={formatPaise(Math.abs(bornePaise))}
            tone={shopIsCovered ? "success" : "danger"}
          />
        </div>

        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3.5 py-3">
          <p className="text-[0.75rem] tracking-wide text-text-secondary uppercase">
            Annualised at this run rate
          </p>
          <p className="numeric mt-1 text-[1.25rem] font-light text-text">
            {formatPaise(annualise(totals.feesPaise, days))}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-text-secondary">
            in gateway fees a year, of which{" "}
            <span
              className={cn(
                "numeric font-medium",
                shopIsCovered ? "text-success-text" : "text-danger-text",
              )}
            >
              {formatPaise(Math.abs(annualise(bornePaise, days)))}
            </span>{" "}
            {shopIsCovered ? "is already recovered from customers." : "lands on the shop."}
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="secondary" size="sm" asChild rightIcon={<ArrowRight size={14} />}>
          <Link href="/settings">Change the fee policy</Link>
        </Button>
        <span className="text-[0.75rem] text-text-tertiary">
          Worked example lives there, on live numbers.
        </span>
      </CardFooter>
    </Card>
  );
}
