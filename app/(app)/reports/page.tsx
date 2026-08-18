"use client";

/**
 * Reports the owner can act on before lunch: what sold, what to buy, what is
 * about to die on the shelf, and what the gateway is costing.
 *
 * The window is 21 days because that is the horizon the counter can still
 * remember and correct. Everything on the page is derived from the same window
 * so two cards never quietly disagree about the period.
 */

import * as React from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Badge, Card, Skeleton, SkeletonText } from "@/components/ui";
import { CAN_SEE_COST, ROLE_LABEL } from "@/components/app/nav";
import { ExpiryExposure } from "@/components/reports/expiry-exposure";
import { GatewayCost } from "@/components/reports/gateway-cost";
import { ReorderList } from "@/components/reports/reorder-list";
import { SalesChart } from "@/components/reports/sales-chart";
import { TopSellers } from "@/components/reports/top-sellers";
import { usePharmacyStore, useCurrentStaff, useHydrated } from "@/lib/store/pharmacy-store";
import type { Bill } from "@/lib/domain/types";

/** The seed spreads its 28 bills across exactly this many days. */
const WINDOW_DAYS = 21;
const DAY_MS = 86_400_000;

function withinWindow(bill: Bill, now: Date, days: number): boolean {
  const stamp = Date.parse(bill.paidAt ?? bill.createdAt);
  if (Number.isNaN(stamp)) return false;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return stamp >= todayUtc - (days - 1) * DAY_MS;
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <SkeletonText lines={1} className="max-w-[16rem]" />
        <Skeleton className="mt-5 h-44 w-full rounded-[var(--radius-md)]" />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SkeletonText lines={6} />
        </Card>
        <Card className="p-5">
          <SkeletonText lines={6} />
        </Card>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const hydrated = useHydrated();
  const staff = useCurrentStaff();
  const bills = usePharmacyStore((s) => s.bills);
  const payments = usePharmacyStore((s) => s.payments);
  const medicines = usePharmacyStore((s) => s.medicines);
  const batches = usePharmacyStore((s) => s.batches);
  const feeConfig = usePharmacyStore((s) => s.feeConfig);

  // One clock for the whole page: two cards computing `new Date()` separately
  // can land either side of midnight and disagree about which day it is.
  const now = React.useMemo(() => new Date(), []);

  const windowBills = React.useMemo(
    () => bills.filter((bill) => withinWindow(bill, now, WINDOW_DAYS)),
    [bills, now],
  );

  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  return (
    <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] leading-tight font-light tracking-[-0.02em] text-text">
            Reports
          </h1>
          <p className="mt-1 text-[0.8125rem] text-text-secondary">
            The last {WINDOW_DAYS} days of trading, and the stock decisions that follow from it.
          </p>
        </div>
        {staff ? (
          <Badge
            tone={canSeeCost ? "brand" : "neutral"}
            title={
              canSeeCost
                ? "Cost price and margin are visible in this session."
                : "Cost price is hidden for this role."
            }
          >
            {canSeeCost ? <Eye size={13} aria-hidden="true" /> : <EyeSlash size={13} aria-hidden="true" />}
            {ROLE_LABEL[staff.role]}
            {canSeeCost ? " · cost visible" : " · cost hidden"}
          </Badge>
        ) : null}
      </header>

      {!hydrated ? (
        <ReportsSkeleton />
      ) : (
        <>
          <SalesChart bills={windowBills} now={now} days={WINDOW_DAYS} />

          <div className="grid gap-5 xl:grid-cols-2">
            <TopSellers bills={windowBills} />
            <GatewayCost
              bills={windowBills}
              payments={payments}
              feeConfig={feeConfig}
              days={WINDOW_DAYS}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ReorderList medicines={medicines} batches={batches} now={now} />
            <ExpiryExposure
              medicines={medicines}
              batches={batches}
              now={now}
              canSeeCost={canSeeCost}
            />
          </div>
        </>
      )}
    </div>
  );
}
