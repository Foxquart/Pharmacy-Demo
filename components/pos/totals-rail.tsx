"use client";

import * as React from "react";
import { Money, QrCode } from "@phosphor-icons/react";

import { Button, Kbd, NumberInput, Segmented } from "@/components/ui";
import { formatPaise, formatPaiseTight } from "@/lib/domain/money";
import type { CartTotals } from "@/lib/domain/selectors";
import type { FeeConfig } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { KeyboardLegend } from "./keyboard-legend";

export type CounterMethod = "CASH" | "UPI";

export interface TotalsRailProps {
  totals: CartTotals;
  feeConfig: FeeConfig;
  method: CounterMethod;
  onMethodChange: (method: CounterMethod) => void;
  tendered: string;
  /** Parsed once by the parent so the rail and the bill agree to the paise. */
  tenderedPaise: number;
  onTenderedChange: (value: string) => void;
  canCheckout: boolean;
  /** Why the checkout button is disabled, said out loud rather than left to guess. */
  blockedReason: string | null;
  onCheckout: () => void;
}

function Row({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "muted" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <div className="min-w-0">
        <span
          className={cn(
            "text-[0.8125rem]",
            tone === "muted" ? "text-text-tertiary" : "text-text-secondary",
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
          "numeric shrink-0 text-[0.875rem]",
          tone === "success" ? "text-success-text" : "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const METHOD_OPTIONS = [
  { value: "CASH" as const, label: "Cash", icon: <Money size={15} weight="fill" /> },
  { value: "UPI" as const, label: "UPI", icon: <QrCode size={15} weight="fill" /> },
];

/**
 * The running total. Every figure here is read straight off `useCartTotals`;
 * this component never does arithmetic on money, with the single exception of
 * change due, which is one integer subtraction of paise against the tendered
 * amount the operator typed.
 */
export function TotalsRail({
  totals,
  feeConfig,
  method,
  onMethodChange,
  tendered,
  tenderedPaise,
  onTenderedChange,
  canCheckout,
  blockedReason,
  onCheckout,
}: TotalsRailProps) {
  const isUpi = method === "UPI";
  const payablePaise = isUpi ? totals.payablePaise : totals.totalPaise;

  const changePaise = tenderedPaise - totals.totalPaise;

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="mb-2 text-[0.75rem] font-medium text-text-secondary">Payment method</p>
        <Segmented
          aria-label="Payment method"
          options={METHOD_OPTIONS}
          value={method}
          onValueChange={onMethodChange}
          fullWidth
        />
      </div>

      <div className="border-t border-border pt-3">
        <Row
          label="Items"
          value={
            <>
              {totals.itemCount}
              <span className="text-text-tertiary"> / {totals.unitCount} units</span>
            </>
          }
        />
        <Row label="Subtotal" value={formatPaise(totals.subtotalPaise)} />
        <Row
          label="Discount"
          value={totals.discountPaise > 0 ? `- ${formatPaise(totals.discountPaise)}` : formatPaise(0)}
          tone={totals.discountPaise > 0 ? "success" : "default"}
        />
        <Row
          label="GST"
          hint="already contained in the MRP, not added on top"
          value={formatPaise(totals.taxPaise)}
          tone="muted"
        />
        <Row
          label="Round off"
          value={`${totals.roundOffPaise >= 0 ? "+" : "-"} ${formatPaise(Math.abs(totals.roundOffPaise))}`}
          tone="muted"
        />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[0.875rem] font-medium text-text">Total</span>
          <span className="numeric text-[1.5rem] leading-none font-light tracking-[-0.02em] text-text">
            {formatPaise(totals.totalPaise)}
          </span>
        </div>

        {isUpi ? (
          <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5">
            <Row
              label={feeConfig.label}
              hint="grossed up so the shop still nets the total after the gateway cut"
              value={`+ ${formatPaise(totals.convenienceFeePaise)}`}
            />
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <span className="text-[0.8125rem] font-medium text-text">Customer pays</span>
              <span className="numeric text-[1.0625rem] font-medium text-text">
                {formatPaise(totals.payablePaise)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5">
            <NumberInput
              size="sm"
              label="Cash tendered"
              hint="₹"
              placeholder="0"
              value={tendered}
              onChange={(event) => onTenderedChange(event.target.value)}
            />
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <span className="text-[0.8125rem] text-text-secondary">Change due</span>
              <span
                className={cn(
                  "numeric text-[1.0625rem] font-medium",
                  tenderedPaise === 0
                    ? "text-text-tertiary"
                    : changePaise < 0
                      ? "text-danger-text"
                      : "text-success-text",
                )}
              >
                {tenderedPaise === 0
                  ? formatPaiseTight(0)
                  : changePaise < 0
                    ? `short ${formatPaise(Math.abs(changePaise))}`
                    : formatPaise(changePaise)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {blockedReason ? (
          <p className="text-[0.75rem] leading-snug text-warning-text">{blockedReason}</p>
        ) : null}

        <Button
          size="xl"
          fullWidth
          disabled={!canCheckout}
          onClick={onCheckout}
          leftIcon={isUpi ? <QrCode size={18} weight="fill" /> : <Money size={18} weight="fill" />}
        >
          <span className="flex items-center gap-2">
            {isUpi ? "Show UPI QR" : "Take cash"}
            <span className="numeric font-medium">{formatPaiseTight(payablePaise)}</span>
            <Kbd size="sm" className="border-on-brand/25 bg-on-brand/15 text-on-brand">
              {isUpi ? "F8" : "F4"}
            </Kbd>
          </span>
        </Button>

        <KeyboardLegend className="border-t border-border pt-3" />
      </div>
    </div>
  );
}

export interface MobileTotalsProps {
  totals: CartTotals;
  feeConfig: FeeConfig;
  method: CounterMethod;
  tendered: string;
  tenderedPaise: number;
  onTenderedChange: (value: string) => void;
}

/**
 * The breakdown the rail carries on a laptop, folded into the page flow on a
 * phone. The sticky bar holds the total and the pay button; everything a
 * customer might question (the GST already inside the MRP, the round off, the
 * change due on a cash sale) lives here rather than being dropped on mobile.
 */
export function MobileTotals({
  totals,
  feeConfig,
  method,
  tendered,
  tenderedPaise,
  onTenderedChange,
}: MobileTotalsProps) {
  const isUpi = method === "UPI";
  const changePaise = tenderedPaise - totals.totalPaise;

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <Row
        label="Items"
        value={
          <>
            {totals.itemCount}
            <span className="text-text-tertiary"> / {totals.unitCount} units</span>
          </>
        }
      />
      <Row label="Subtotal" value={formatPaise(totals.subtotalPaise)} />
      <Row
        label="Discount"
        value={totals.discountPaise > 0 ? `- ${formatPaise(totals.discountPaise)}` : formatPaise(0)}
        tone={totals.discountPaise > 0 ? "success" : "default"}
      />
      <Row
        label="GST"
        hint="already contained in the MRP, not added on top"
        value={formatPaise(totals.taxPaise)}
        tone="muted"
      />
      <Row
        label="Round off"
        value={`${totals.roundOffPaise >= 0 ? "+" : "-"} ${formatPaise(Math.abs(totals.roundOffPaise))}`}
        tone="muted"
      />

      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-3">
        <span className="text-[0.875rem] font-medium text-text">Total</span>
        <span className="numeric text-[1.375rem] leading-none font-light tracking-[-0.018em] text-text">
          {formatPaise(totals.totalPaise)}
        </span>
      </div>

      {isUpi ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5">
          <Row
            label={feeConfig.label}
            hint="grossed up so the shop still nets the total after the gateway cut"
            value={`+ ${formatPaise(totals.convenienceFeePaise)}`}
          />
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2">
            <span className="text-[0.8125rem] font-medium text-text">Customer pays</span>
            <span className="numeric text-[1.0625rem] font-medium text-text">
              {formatPaise(totals.payablePaise)}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5">
          <NumberInput
            label="Cash tendered"
            hint="₹"
            placeholder="0"
            value={tendered}
            onChange={(event) => onTenderedChange(event.target.value)}
          />
          <div className="mt-2.5 flex items-baseline justify-between gap-4 border-t border-border pt-2.5">
            <span className="text-[0.8125rem] text-text-secondary">Change due</span>
            <span
              className={cn(
                "numeric text-[1.0625rem] font-medium",
                tenderedPaise === 0
                  ? "text-text-tertiary"
                  : changePaise < 0
                    ? "text-danger-text"
                    : "text-success-text",
              )}
            >
              {tenderedPaise === 0
                ? formatPaiseTight(0)
                : changePaise < 0
                  ? `short ${formatPaise(Math.abs(changePaise))}`
                  : formatPaise(changePaise)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export interface MobilePayBarProps {
  totals: CartTotals;
  method: CounterMethod;
  onMethodChange: (method: CounterMethod) => void;
  canCheckout: boolean;
  /** Why pay is disabled. Said out loud here too: on a phone the rail that
   *  normally explains it is not on screen at all. */
  blockedReason?: string | null;
  onCheckout: () => void;
}

/**
 * Below `lg` the rail folds into this: a sticky bar carrying the item count, the
 * amount and one full-width pay button.
 *
 * It sits above `env(safe-area-inset-bottom)` so the button clears the iOS home
 * indicator rather than sharing a strip of glass with it.
 */
export function MobilePayBar({
  totals,
  method,
  onMethodChange,
  canCheckout,
  blockedReason,
  onCheckout,
}: MobilePayBarProps) {
  const isUpi = method === "UPI";
  const payablePaise = isUpi ? totals.payablePaise : totals.totalPaise;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-lg lg:hidden",
        "px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] text-text-tertiary">
            <span className="numeric">{totals.itemCount}</span>{" "}
            {totals.itemCount === 1 ? "item" : "items"} ·{" "}
            <span className="numeric">{totals.unitCount}</span> units
          </p>
          <p className="numeric text-[1.375rem] leading-tight font-light tracking-[-0.018em] text-text">
            {formatPaise(payablePaise)}
          </p>
        </div>

        <Segmented
          aria-label="Payment method"
          options={METHOD_OPTIONS}
          value={method}
          onValueChange={onMethodChange}
          size="sm"
          className="ml-auto shrink-0"
        />
      </div>

      {blockedReason ? (
        <p className="mt-1.5 text-[0.75rem] leading-snug text-warning-text">{blockedReason}</p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        className="mt-2"
        disabled={!canCheckout}
        onClick={onCheckout}
        leftIcon={isUpi ? <QrCode size={17} weight="fill" /> : <Money size={17} weight="fill" />}
      >
        <span className="flex items-center gap-2">
          {isUpi ? "Show UPI QR" : "Take cash"}
          <span className="numeric font-medium">{formatPaiseTight(payablePaise)}</span>
        </span>
      </Button>
    </div>
  );
}
