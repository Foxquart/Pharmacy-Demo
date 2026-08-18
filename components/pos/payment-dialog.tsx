"use client";

import * as React from "react";
import { ArrowsClockwise, Clock, Money, WarningOctagon } from "@phosphor-icons/react";

import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { formatPaise } from "@/lib/domain/money";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";
import type { WebhookEvent } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { SettledSummary } from "./settled-summary";
import { UpiQr } from "./upi-qr";
import { WebhookInspector } from "./webhook-inspector";

export type CheckoutState =
  | { kind: "CASH"; billId: string }
  | { kind: "UPI"; billId: string; paymentId: string };

export interface PaymentDialogProps {
  checkout: CheckoutState | null;
  /** Cash only: what the operator hands back, in paise. */
  changePaise: number | null;
  onClose: () => void;
  onNewSale: () => void;
  /** A fresh QR for the same bill after a failure or a timeout. */
  onRegenerate: (billId: string) => void;
}

export function PaymentDialog({
  checkout,
  changePaise,
  onClose,
  onNewSale,
  onRegenerate,
}: PaymentDialogProps) {
  return (
    <Dialog
      open={checkout !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent size="lg" closeLabel="Close payment">
        {checkout ? (
          <PaymentDialogBody
            checkout={checkout}
            changePaise={changePaise}
            onNewSale={onNewSale}
            onRegenerate={onRegenerate}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function secondsUntil(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.round((target - Date.now()) / 1000));
}

function useSecondsLeft(expiresAt: string | undefined): number | null {
  const [left, setLeft] = React.useState<number | null>(() => secondsUntil(expiresAt));
  // A fresh QR carries a new deadline, and the countdown has to restart on the
  // render that shows it rather than a tick later.
  const [tracked, setTracked] = React.useState(expiresAt);
  if (tracked !== expiresAt) {
    setTracked(expiresAt);
    setLeft(secondsUntil(expiresAt));
  }

  React.useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setLeft(secondsUntil(expiresAt)), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return left;
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

interface BodyProps {
  checkout: CheckoutState;
  changePaise: number | null;
  onNewSale: () => void;
  onRegenerate: (billId: string) => void;
}

function PaymentDialogBody({ checkout, changePaise, onNewSale, onRegenerate }: BodyProps) {
  const bills = usePharmacyStore((state) => state.bills);
  const payments = usePharmacyStore((state) => state.payments);
  const movements = usePharmacyStore((state) => state.movements);
  const settlePayment = usePharmacyStore((state) => state.settlePayment);
  const markCashPaid = usePharmacyStore((state) => state.markCashPaid);

  const [event, setEvent] = React.useState<WebhookEvent | null>(null);
  const [eventPaymentId, setEventPaymentId] = React.useState<string | null>(null);

  const bill = bills.find((candidate) => candidate.id === checkout.billId) ?? null;
  const payment =
    checkout.kind === "UPI"
      ? (payments.find((candidate) => candidate.id === checkout.paymentId) ?? null)
      : null;

  const saleMovements = React.useMemo(
    () =>
      movements.filter(
        (movement) => movement.billId === checkout.billId && movement.type === "SALE",
      ),
    [movements, checkout.billId],
  );

  const secondsLeft = useSecondsLeft(payment?.expiresAt);
  const expired = secondsLeft !== null && secondsLeft <= 0 && payment?.status !== "PAID";

  // A new payment for the same bill starts a new attempt, so the old event must
  // not linger under the fresh QR.
  const currentPaymentId = payment?.id ?? null;
  if (eventPaymentId !== currentPaymentId) {
    setEventPaymentId(currentPaymentId);
    setEvent(null);
  }

  if (!bill) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>That bill is gone</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Alert
            tone="danger"
            title="The bill this payment belonged to is no longer in the store."
            description="Nothing was charged and no stock moved. Start the sale again."
          />
        </DialogBody>
      </>
    );
  }

  const settled = bill.status === "PAID";
  const paidPayment = payment && payment.status === "PAID" ? payment : null;
  const failed = payment?.status === "FAILED";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {settled
            ? "Settled"
            : failed
              ? "Payment failed"
              : expired
                ? "That code timed out"
                : checkout.kind === "UPI"
                  ? "Waiting for the customer to pay"
                  : "Cash sale"}
        </DialogTitle>
        <DialogDescription>
          Bill <span className="numeric">{bill.billNumber}</span> ·{" "}
          {bill.items.length} {bill.items.length === 1 ? "line" : "lines"}
          {bill.prescriptionRef ? (
            <>
              {" "}
              · Rx <span className="numeric">{bill.prescriptionRef}</span>
            </>
          ) : null}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-5">
        {settled ? (
          <SettledSummary
            bill={bill}
            payment={paidPayment}
            movements={saleMovements}
            changePaise={changePaise}
          />
        ) : checkout.kind === "UPI" && payment ? (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <UpiQr
              upiUri={payment.upiUri ?? ""}
              size={280}
              spent={expired || failed}
              // Never below roughly 240px of actual code, which is the point a
              // camera across a counter starts needing a second attempt.
              className="min-w-[15rem] max-sm:max-w-[16.5rem]"
            />

            <div className="flex min-w-0 w-full flex-1 flex-col gap-3">
              <div>
                <p className="text-[0.75rem] text-text-secondary">Customer pays</p>
                <p className="numeric text-[1.875rem] leading-none font-medium tracking-[-0.018em] text-text sm:text-[2.25rem]">
                  {formatPaise(payment.amountPaise)}
                </p>
                {bill.convenienceFeePaise > 0 ? (
                  <p className="mt-1.5 text-[0.75rem] text-text-tertiary">
                    bill{" "}
                    <span className="numeric">{formatPaise(bill.totalPaise)}</span> plus{" "}
                    <span className="numeric">{formatPaise(bill.convenienceFeePaise)}</span>{" "}
                    so the shop still nets the total after the gateway cut
                  </p>
                ) : null}
              </div>

              <StatusLine
                state={failed ? "failed" : expired ? "expired" : "waiting"}
                secondsLeft={secondsLeft}
              />

              <p className="order-last text-[0.75rem] leading-relaxed text-text-secondary sm:order-none">
                Any UPI app resolves this code. It is a real NPCI deep link built from the
                shop VPA, the amount and the bill number as the transaction reference.
              </p>

              <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-col">
                <Alert
                  tone="info"
                  title="Demo controls"
                  description="In production nothing below exists. The gateway calls the shop's server with a signed webhook and the same settlement handler runs. These buttons only stand in for that call."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="md"
                    variant="success"
                    className="max-sm:h-11 max-sm:flex-1"
                    onClick={() => setEvent(settlePayment(payment.id, "PAID"))}
                  >
                    Simulate customer payment
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="max-sm:h-11"
                    onClick={() => setEvent(settlePayment(payment.id, "FAILED"))}
                  >
                    Simulate failure
                  </Button>
                </div>
              </div>

              {(failed || expired) && bill.status === "AWAITING_PAYMENT" ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="max-sm:h-11"
                    leftIcon={<ArrowsClockwise size={14} />}
                    onClick={() => onRegenerate(bill.id)}
                  >
                    Show a fresh QR
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="max-sm:h-11"
                    leftIcon={<Money size={14} />}
                    onClick={() => markCashPaid(bill.id)}
                  >
                    Take cash instead
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <Alert
            tone="danger"
            icon={<WarningOctagon size={17} weight="fill" />}
            title="This bill was not settled"
            description="It is still open. Find it under Payments and settle or cancel it there. No stock has moved."
          />
        )}

        {event ? <WebhookInspector event={event} /> : null}
      </DialogBody>

      <DialogFooter>
        {settled ? (
          <Button size="lg" className="max-sm:w-full" onClick={onNewSale}>
            New sale
          </Button>
        ) : (
          <Button size="md" variant="secondary" className="max-sm:h-11 max-sm:w-full" onClick={onNewSale}>
            Leave it open
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function StatusLine({
  state,
  secondsLeft,
}: {
  state: "waiting" | "expired" | "failed";
  secondsLeft: number | null;
}) {
  const label =
    state === "failed"
      ? "Payment failed. Nothing was captured and no stock moved."
      : state === "expired"
        ? "This code has timed out. Show a fresh one."
        : "Waiting for the customer to confirm in their UPI app.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2",
        state === "failed"
          ? "border-danger-border bg-danger-subtle text-danger-text"
          : state === "expired"
            ? "border-warning-border bg-warning-subtle text-warning-text"
            : "border-border bg-bg-sunken text-text-secondary",
      )}
    >
      {state === "waiting" ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-[ui-fade-in_1s_var(--ease-out-quart)_infinite_alternate]"
        />
      ) : (
        <WarningOctagon size={14} weight="fill" aria-hidden="true" className="shrink-0" />
      )}
      <span className="min-w-0 flex-1 text-[0.8125rem]">{label}</span>
      {state === "waiting" && secondsLeft !== null ? (
        <span className="numeric flex shrink-0 items-center gap-1 text-[0.8125rem]">
          <Clock size={13} aria-hidden="true" />
          {formatClock(secondsLeft)}
        </span>
      ) : null}
    </div>
  );
}
