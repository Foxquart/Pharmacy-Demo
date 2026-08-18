"use client";

/**
 * The money view: every bill the shop has raised, and what actually settled.
 *
 * Two things this page exists to make visible:
 *  1. The difference between what the customer paid and what the shop received.
 *     They are not the same number the moment a gateway is involved.
 *  2. The webhook log, including the events the replay guard threw away. That
 *     guard is the only thing standing between a retried gateway delivery and a
 *     second decrement of the same stock.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  CaretDown,
  Receipt,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Segmented,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  SkeletonText,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { formatBps, formatPaise, formatPaiseTight } from "@/lib/domain/money";
import { splitCgstSgst } from "@/lib/domain/selectors";
import type {
  Bill,
  BillStatus,
  Payment,
  PaymentMethod,
  Role,
  ShopSettings,
  Staff,
  WebhookEvent,
} from "@/lib/domain/types";
import { usePharmacyStore, useCurrentStaff, useHydrated } from "@/lib/store/pharmacy-store";
import { cn } from "@/lib/utils";

/**
 * Reversing a settled sale writes stock back onto the shelf, so it is not a
 * till-level action. Stated here rather than inferred from the nav so the rule
 * is readable at the point it is enforced.
 */
const CAN_CANCEL_BILL: Role[] = ["OWNER", "PHARMACIST"];

const STATUS_TONE: Record<BillStatus, BadgeTone> = {
  DRAFT: "neutral",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  CANCELLED: "neutral",
  REFUNDED: "danger",
};

const STATUS_LABEL: Record<BillStatus, string> = {
  DRAFT: "Draft",
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const EVENT_TONE: Record<WebhookEvent["status"], BadgeTone> = {
  RECEIVED: "neutral",
  PROCESSED: "success",
  IGNORED: "warning",
  FAILED: "danger",
};

type StatusFilter = "ALL" | BillStatus;
type MethodFilter = "ALL" | "CASH" | "UPI";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "AWAITING_PAYMENT", label: "Awaiting" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

const METHOD_OPTIONS: Array<{ value: MethodFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
];

/* Timestamps are rendered in UTC, the same frame the day buckets are built in,
   so a bill filed under "today" never prints yesterday's clock time. */
const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const STAMP_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const EXPIRY_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

// ─────────────────────────── invoice ───────────────────────────

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] tracking-wide text-text-tertiary uppercase">{label}</dt>
      <dd className="mt-0.5 text-[0.8125rem] leading-snug text-text">{value}</dd>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  tone = "neutral",
  hint,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  tone?: "neutral" | "success" | "danger";
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="min-w-0 text-[0.8125rem] text-text-secondary">
        {label}
        {hint ? <span className="block text-[0.6875rem] text-text-tertiary">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "numeric shrink-0",
          strong ? "text-[0.9375rem] font-medium" : "text-[0.8125rem]",
          tone === "success" && "text-success-text",
          tone === "danger" && "text-danger-text",
          tone === "neutral" && "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function BillInvoice({
  bill,
  payment,
  settings,
  cashier,
}: {
  bill: Bill;
  payment: Payment | null;
  settings: ShopSettings;
  cashier: Staff | null;
}) {
  // One row per GST slab, the way an Indian tax invoice prints it. CGST and
  // SGST are the same intra-state tax split in half, never two rates.
  const taxRows = React.useMemo(() => {
    const byRate = new Map<number, { taxableValue: number; taxPaise: number }>();
    for (const item of bill.items) {
      const row = byRate.get(item.gstBps) ?? { taxableValue: 0, taxPaise: 0 };
      row.taxableValue += item.lineTotalPaise - item.taxPaise;
      row.taxPaise += item.taxPaise;
      byRate.set(item.gstBps, row);
    }
    return Array.from(byRate.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([gstBps, row]) => ({ gstBps, ...row, ...splitCgstSgst(row.taxPaise) }));
  }, [bill.items]);

  const totalSplit = splitCgstSgst(bill.taxPaise);

  return (
    <div className="flex flex-col gap-6">
      {/* shop */}
      <section className="rounded-[var(--radius-md)] border border-border bg-bg-sunken p-3.5">
        <p className="text-[0.9375rem] font-medium text-text">{settings.shopName}</p>
        <p className="text-[0.75rem] text-text-secondary">{settings.legalName}</p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-text-secondary">
          {settings.addressLine1}, {settings.addressLine2}
          <br />
          {settings.city} {settings.pincode}, {settings.state}
          <br />
          {settings.phone} · {settings.email}
        </p>
        <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border pt-2.5">
          <KeyValue label="GSTIN" value={<span className="numeric">{settings.gstin}</span>} />
          <KeyValue
            label="Drug licence"
            value={<span className="numeric text-[0.75rem]">{settings.drugLicenseNo}</span>}
          />
        </dl>
      </section>

      {/* bill meta */}
      <section>
        <dl className="grid grid-cols-2 gap-3">
          <KeyValue label="Invoice" value={<span className="numeric">{bill.billNumber}</span>} />
          <KeyValue
            label="Raised"
            value={<span className="numeric">{STAMP_FMT.format(new Date(bill.createdAt))}</span>}
          />
          <KeyValue label="Cashier" value={cashier?.name ?? bill.cashierId} />
          <KeyValue
            label="Status"
            value={
              <Badge size="sm" tone={STATUS_TONE[bill.status]} dot>
                {STATUS_LABEL[bill.status]}
              </Badge>
            }
          />
          <KeyValue label="Customer" value={bill.customerName ?? "Walk-in"} />
          <KeyValue
            label="Phone"
            value={<span className="numeric">{bill.customerPhone ?? "-"}</span>}
          />
          {bill.doctorName ? <KeyValue label="Prescriber" value={bill.doctorName} /> : null}
          {bill.prescriptionRef ? (
            <KeyValue
              label="Prescription"
              value={<span className="numeric">{bill.prescriptionRef}</span>}
            />
          ) : null}
        </dl>
      </section>

      {/* items */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[0.8125rem] font-medium text-text">
          Items <span className="numeric text-text-tertiary">({bill.items.length})</span>
        </h3>
        <div className="rounded-[var(--radius-md)] border border-border">
          <Table aria-label={`Line items on ${bill.billNumber}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead numeric>Qty</TableHead>
                <TableHead numeric>Rate</TableHead>
                <TableHead numeric>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="py-2">
                    <span className="block font-medium text-text">{item.nameSnapshot}</span>
                    <span className="block text-[0.6875rem] text-text-tertiary">
                      {item.genericSnapshot}
                    </span>
                    <span className="numeric mt-0.5 block text-[0.6875rem] text-text-tertiary">
                      batch {item.batchNumberSnapshot} · exp{" "}
                      {EXPIRY_FMT.format(new Date(item.expirySnapshot))} · HSN {item.hsnSnapshot} ·
                      GST {formatBps(item.gstBps)}
                    </span>
                  </TableCell>
                  <TableCell numeric className="align-top">
                    {item.quantity}
                    <span className="ml-1 text-[0.6875rem] text-text-tertiary">
                      {item.unitLabel}
                    </span>
                  </TableCell>
                  <TableCell numeric className="align-top">
                    {formatPaiseTight(item.unitPricePaise)}
                    {item.mrpPaise !== item.unitPricePaise ? (
                      <span className="block text-[0.6875rem] text-text-tertiary line-through">
                        {formatPaiseTight(item.mrpPaise)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell numeric className="align-top font-medium">
                    {formatPaise(item.lineTotalPaise)}
                    {item.discountPaise > 0 ? (
                      <span className="block text-[0.6875rem] text-success-text">
                        −{formatPaise(item.discountPaise)}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* tax */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[0.8125rem] font-medium text-text">Tax summary</h3>
        <p className="text-[0.75rem] leading-relaxed text-text-secondary">
          Retail MRP in India is tax inclusive, so GST is extracted from the line total rather
          than added to it.
        </p>
        <div className="rounded-[var(--radius-md)] border border-border">
          <Table aria-label="CGST and SGST breakdown">
            <TableHeader>
              <TableRow>
                <TableHead numeric>GST</TableHead>
                <TableHead numeric>Taxable</TableHead>
                <TableHead numeric>CGST</TableHead>
                <TableHead numeric>SGST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRows.map((row) => (
                <TableRow key={row.gstBps}>
                  <TableCell numeric>{formatBps(row.gstBps)}</TableCell>
                  <TableCell numeric>{formatPaise(row.taxableValue)}</TableCell>
                  <TableCell numeric>{formatPaise(row.cgstPaise)}</TableCell>
                  <TableCell numeric>{formatPaise(row.sgstPaise)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell numeric className="font-medium">
                  {formatPaise(bill.subtotalPaise - bill.discountPaise - bill.taxPaise)}
                </TableCell>
                <TableCell numeric className="font-medium">
                  {formatPaise(totalSplit.cgstPaise)}
                </TableCell>
                <TableCell numeric className="font-medium">
                  {formatPaise(totalSplit.sgstPaise)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* totals */}
      <section className="rounded-[var(--radius-md)] border border-border p-3.5">
        <div className="divide-y divide-border">
          <TotalRow label="Subtotal" value={formatPaise(bill.subtotalPaise)} />
          {bill.discountPaise > 0 ? (
            <TotalRow
              label="Discount"
              value={`−${formatPaise(bill.discountPaise)}`}
              tone="success"
            />
          ) : null}
          <TotalRow label="GST contained in the above" value={formatPaise(bill.taxPaise)} />
          {bill.roundOffPaise !== 0 ? (
            <TotalRow label="Round off" value={formatPaise(bill.roundOffPaise)} />
          ) : null}
          <TotalRow label="Bill total" value={formatPaise(bill.totalPaise)} strong />
          {bill.convenienceFeePaise > 0 ? (
            <TotalRow
              label="Convenience fee"
              hint="Gross-up so the shop still nets the bill total"
              value={formatPaise(bill.convenienceFeePaise)}
            />
          ) : null}
          <TotalRow label="Customer pays" value={formatPaise(bill.payablePaise)} strong />
        </div>
      </section>

      {/* settlement */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[0.8125rem] font-medium text-text">Settlement</h3>
        {payment ? (
          <div className="rounded-[var(--radius-md)] border border-border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <span className="numeric text-[0.75rem] text-text-secondary">
                {payment.provider} · {payment.providerPaymentId ?? payment.id}
              </span>
              <Badge size="sm" tone={payment.status === "PAID" ? "success" : "warning"} dot>
                {payment.status}
              </Badge>
            </div>
            <div className="divide-y divide-border border-t border-border">
              <TotalRow label="Captured from customer" value={formatPaise(payment.amountPaise)} />
              <TotalRow
                label="Gateway fee deducted"
                value={`−${formatPaise(payment.gatewayFeePaise)}`}
                tone="danger"
              />
              <TotalRow
                label="Net into the shop account"
                value={formatPaise(payment.netPaise)}
                strong
                tone={payment.netPaise >= bill.totalPaise ? "success" : "danger"}
              />
              <TotalRow
                label={
                  payment.netPaise >= bill.totalPaise
                    ? "Against bill total, shop is whole by"
                    : "Against bill total, shop is short by"
                }
                value={formatPaise(Math.abs(payment.netPaise - bill.totalPaise))}
                tone={payment.netPaise >= bill.totalPaise ? "success" : "danger"}
              />
            </div>
            {payment.payerVpa ? (
              <p className="numeric mt-2 border-t border-border pt-2 text-[0.75rem] text-text-tertiary">
                paid from {payment.payerVpa}
                {payment.paidAt ? ` · ${STAMP_FMT.format(new Date(payment.paidAt))}` : ""}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-[var(--radius-md)] border border-border bg-bg-sunken p-3.5 text-[0.8125rem] leading-relaxed text-text-secondary">
            Cash at the counter. No gateway touched this bill, so the shop keeps the whole{" "}
            <span className="numeric font-medium text-text">{formatPaise(bill.totalPaise)}</span>.
          </p>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────── webhook log ───────────────────────────

function WebhookRow({ event }: { event: WebhookEvent }) {
  const [open, setOpen] = React.useState(false);
  const payloadId = `${event.id}-payload`;
  const ignored = event.status === "IGNORED";

  return (
    <li
      className={cn(
        "rounded-[var(--radius-md)] border p-3.5",
        ignored ? "border-warning-border bg-warning-subtle" : "border-border bg-surface",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="sm" tone={EVENT_TONE[event.status]} dot>
              {event.status}
            </Badge>
            <span className="numeric text-[0.8125rem] font-medium text-text">
              {event.eventType}
            </span>
          </div>
          <p className="numeric mt-1 text-[0.75rem] break-all text-text-secondary">
            {event.eventId}
          </p>
        </div>
        <span className="numeric shrink-0 text-[0.75rem] text-text-tertiary">
          {STAMP_FMT.format(new Date(event.receivedAt))}
        </span>
      </div>

      {ignored ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-[0.8125rem] leading-relaxed",
            "text-warning-text",
          )}
        >
          <ShieldCheck size={15} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
          <span>
            Replay guard. The gateway delivered this event twice, the bill was already marked
            committed, so the second copy was recorded and dropped instead of decrementing the
            stock again.
            {event.note ? <span className="block opacity-80">{event.note}</span> : null}
          </span>
        </p>
      ) : event.note ? (
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-secondary">{event.note}</p>
      ) : null}

      <p className="mt-2 text-[0.6875rem] text-text-tertiary">
        <span className="tracking-wide uppercase">Signature</span>{" "}
        <span className="numeric break-all">{event.signature}</span>
      </p>

      <div className="mt-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={payloadId}
          rightIcon={
            <CaretDown
              size={13}
              className={cn(
                "transition-transform duration-150 ease-[var(--ease-out-quart)]",
                open && "rotate-180",
              )}
            />
          }
        >
          {open ? "Hide payload" : "Show payload"}
        </Button>
        {open ? (
          <pre
            id={payloadId}
            className="mt-2 max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-bg-sunken p-3 font-mono text-[0.75rem] leading-relaxed text-text-secondary"
          >
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        ) : null}
      </div>
    </li>
  );
}

// ─────────────────────────── page ───────────────────────────

function PaymentsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <SkeletonText lines={2} />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-8 w-64" />
        <SkeletonText lines={8} className="mt-5" />
      </Card>
    </div>
  );
}

export default function PaymentsPage() {
  const hydrated = useHydrated();
  const staff = useCurrentStaff();
  const bills = usePharmacyStore((s) => s.bills);
  const payments = usePharmacyStore((s) => s.payments);
  const webhookEvents = usePharmacyStore((s) => s.webhookEvents);
  const settings = usePharmacyStore((s) => s.settings);
  const staffList = usePharmacyStore((s) => s.staff);
  const cancelBill = usePharmacyStore((s) => s.cancelBill);

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [methodFilter, setMethodFilter] = React.useState<MethodFilter>("ALL");
  const [selectedBillId, setSelectedBillId] = React.useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  // One clock for the page, so "today" cannot change between two tiles.
  const now = React.useMemo(() => new Date(), []);

  const paymentByBillId = React.useMemo(
    () => new Map(payments.map((payment) => [payment.billId, payment])),
    [payments],
  );
  const staffById = React.useMemo(
    () => new Map(staffList.map((member) => [member.id, member])),
    [staffList],
  );

  const stats = React.useMemo(() => {
    const todayKey = dayKeyOf(now.toISOString());
    let collectedToday = 0;
    let upiToday = 0;
    let cashToday = 0;
    let feesToday = 0;
    let netToday = 0;
    let billsToday = 0;
    let collectedAll = 0;
    let feesAll = 0;
    let netAll = 0;

    for (const bill of bills) {
      if (bill.status !== "PAID") continue;
      const payment = paymentByBillId.get(bill.id);
      const feePaise = payment && payment.status === "PAID" ? payment.gatewayFeePaise : 0;

      collectedAll += bill.payablePaise;
      feesAll += feePaise;
      netAll += bill.payablePaise - feePaise;

      if (dayKeyOf(bill.paidAt ?? bill.createdAt) !== todayKey) continue;
      billsToday += 1;
      collectedToday += bill.payablePaise;
      feesToday += feePaise;
      netToday += bill.payablePaise - feePaise;
      if (bill.method === "UPI") upiToday += bill.payablePaise;
      else cashToday += bill.payablePaise;
    }

    return {
      collectedToday,
      upiToday,
      cashToday,
      feesToday,
      netToday,
      billsToday,
      collectedAll,
      feesAll,
      netAll,
    };
  }, [bills, paymentByBillId, now]);

  const rows = React.useMemo(() => {
    const filtered = bills.filter((bill) => {
      if (statusFilter !== "ALL" && bill.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && bill.method !== (methodFilter as PaymentMethod)) return false;
      return true;
    });
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [bills, statusFilter, methodFilter]);

  const selectedBill = React.useMemo(
    () => bills.find((bill) => bill.id === selectedBillId) ?? null,
    [bills, selectedBillId],
  );

  const canCancel = staff ? CAN_CANCEL_BILL.includes(staff.role) : false;

  const ignoredCount = webhookEvents.filter((event) => event.status === "IGNORED").length;
  const sortedEvents = React.useMemo(
    () => webhookEvents.slice().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [webhookEvents],
  );

  function confirmCancel() {
    if (!selectedBill) return;
    const reason = cancelReason.trim() || "Cancelled from the payments log";
    cancelBill(selectedBill.id, reason);
    setCancelOpen(false);
    setCancelReason("");
    setSelectedBillId(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] leading-tight font-light tracking-[-0.02em] text-text">
            Payments
          </h1>
          <p className="mt-1 text-[0.8125rem] text-text-secondary">
            Every bill raised, and what actually landed in the account.
          </p>
        </div>
      </header>

      {!hydrated ? (
        <PaymentsSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              bordered
              label="Collected today"
              value={formatPaise(stats.collectedToday)}
              hint={
                <>
                  <span className="numeric">{stats.billsToday}</span> bills settled ·{" "}
                  <span className="numeric">{formatPaise(stats.collectedAll)}</span> all time
                </>
              }
            />
            <Stat
              bordered
              label="UPI today"
              value={formatPaise(stats.upiToday)}
              hint={
                <>
                  Cash <span className="numeric">{formatPaise(stats.cashToday)}</span> · cash never
                  touches a gateway
                </>
              }
            />
            <Stat
              bordered
              label="Gateway fees paid today"
              value={formatPaise(stats.feesToday)}
              hint={
                <>
                  <span className="numeric">{formatPaise(stats.feesAll)}</span> across every
                  settled bill
                </>
              }
            />
            <Stat
              bordered
              label="Net to the shop today"
              value={formatPaise(stats.netToday)}
              hint={
                <>
                  <span className="numeric">{formatPaise(stats.netAll)}</span> all time, after the
                  gateway cut
                </>
              }
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Bills</CardTitle>
                  <CardDescription>
                    Newest first. Open a bill for the full invoice and its settlement.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 max-lg:w-full lg:flex-row lg:flex-wrap lg:items-center">
                  <div className="max-lg:-mx-1 max-lg:overflow-x-auto max-lg:px-1 max-lg:py-0.5">
                  <Segmented<StatusFilter>
                    aria-label="Filter bills by status"
                    size="sm"
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                  />
                  </div>
                  <div className="max-lg:-mx-1 max-lg:overflow-x-auto max-lg:px-1 max-lg:py-0.5">
                  <Segmented<MethodFilter>
                    aria-label="Filter bills by payment method"
                    size="sm"
                    value={methodFilter}
                    onValueChange={setMethodFilter}
                    options={METHOD_OPTIONS}
                  />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {rows.length === 0 ? (
                <EmptyState
                  icon={<Receipt size={24} />}
                  title="No bills match these filters"
                  description="Clear the status or method filter, or ring up a sale at the counter."
                  action={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/pos">Go to the counter</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                {/* Below `md` a bill is a card. Nine columns of money on a
                    360px screen would either scroll sideways or drop the
                    numbers that make this page worth opening. */}
                <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border md:hidden">
                  {rows.map((bill) => (
                    <li key={bill.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBillId(bill.id)}
                        className={cn(
                          "flex w-full flex-col gap-2 px-3 py-3 text-left",
                          "transition-colors duration-150 ease-[var(--ease-out-quart)] active:bg-surface-active",
                          bill.id === selectedBillId && "bg-brand-subtle",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="numeric text-[0.9375rem] font-medium text-brand-text">
                            {bill.billNumber}
                          </span>
                          <Badge size="sm" tone={STATUS_TONE[bill.status]} dot>
                            {STATUS_LABEL[bill.status]}
                          </Badge>
                          <Badge size="sm" tone={bill.method === "UPI" ? "brand" : "neutral"}>
                            {bill.method ?? "-"}
                          </Badge>
                        </div>

                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0 text-[0.75rem] text-text-tertiary">
                            <p className="numeric">
                              {DATE_FMT.format(new Date(bill.createdAt))}{" "}
                              {TIME_FMT.format(new Date(bill.createdAt))}
                            </p>
                            <p className="truncate">
                              {staffById.get(bill.cashierId)?.name ?? bill.cashierId} ·{" "}
                              <span className="numeric">{bill.items.length}</span>{" "}
                              {bill.items.length === 1 ? "line" : "lines"}
                              {bill.customerName ? ` · ${bill.customerName}` : ""}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="numeric text-[1.0625rem] font-medium text-text">
                              {formatPaise(bill.payablePaise)}
                            </p>
                            <p className="numeric text-[0.6875rem] text-text-tertiary">
                              bill {formatPaiseTight(bill.totalPaise)}
                              {bill.convenienceFeePaise > 0
                                ? ` · fee ${formatPaiseTight(bill.convenienceFeePaise)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="hidden rounded-[var(--radius-md)] border border-border md:block">
                  <Table
                    stickyHeader
                    containerClassName="max-h-[36rem]"
                    aria-label="Bills, newest first"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill</TableHead>
                        <TableHead numeric>Time</TableHead>
                        <TableHead>Cashier</TableHead>
                        <TableHead numeric>Items</TableHead>
                        <TableHead numeric>Total</TableHead>
                        <TableHead numeric>Fee</TableHead>
                        <TableHead numeric>Payable</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((bill) => (
                        <TableRow
                          key={bill.id}
                          interactive
                          selected={bill.id === selectedBillId}
                          onClick={() => setSelectedBillId(bill.id)}
                        >
                          <TableCell>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBillId(bill.id);
                              }}
                              className={cn(
                                "numeric rounded-[var(--radius-sm)] text-[0.8125rem] font-medium text-brand-text",
                                "transition-colors duration-150 ease-[var(--ease-out-quart)] hover:text-brand-hover",
                              )}
                            >
                              {bill.billNumber}
                            </button>
                            {bill.customerName ? (
                              <span className="block text-[0.6875rem] text-text-tertiary">
                                {bill.customerName}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell numeric className="whitespace-nowrap">
                            {TIME_FMT.format(new Date(bill.createdAt))}
                            <span className="block text-[0.6875rem] text-text-tertiary">
                              {DATE_FMT.format(new Date(bill.createdAt))}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-text-secondary">
                            {staffById.get(bill.cashierId)?.name ?? bill.cashierId}
                          </TableCell>
                          <TableCell numeric>{bill.items.length}</TableCell>
                          <TableCell numeric>{formatPaise(bill.totalPaise)}</TableCell>
                          <TableCell
                            numeric
                            className={
                              bill.convenienceFeePaise > 0 ? "text-text" : "text-text-tertiary"
                            }
                          >
                            {bill.convenienceFeePaise > 0
                              ? formatPaise(bill.convenienceFeePaise)
                              : "-"}
                          </TableCell>
                          <TableCell numeric className="font-medium">
                            {formatPaise(bill.payablePaise)}
                          </TableCell>
                          <TableCell>
                            <Badge size="sm" tone={bill.method === "UPI" ? "brand" : "neutral"}>
                              {bill.method ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge size="sm" tone={STATUS_TONE[bill.status]} dot>
                              {STATUS_LABEL[bill.status]}
                            </Badge>
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

          <Card>
            <CardHeader>
              <CardTitle>Gateway event log</CardTitle>
              <CardDescription>
                Every inbound webhook is written down before any stock moves, keyed on the
                provider event id, so a replay is detected before it can do damage.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Alert
                tone={ignoredCount > 0 ? "warning" : "info"}
                icon={ignoredCount > 0 ? <Warning size={17} weight="fill" /> : undefined}
                title={
                  ignoredCount > 0
                    ? `${ignoredCount} event${ignoredCount === 1 ? "" : "s"} ignored by the replay guard`
                    : "No replays recorded yet"
                }
                description="An IGNORED event is a duplicate delivery from the gateway that arrived after the bill was already committed, so it was recorded and dropped instead of decrementing the same stock a second time."
              />

              {sortedEvents.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<ShieldCheck size={22} />}
                  title="No gateway events yet"
                  description="Settle a UPI bill at the counter and its webhook will be logged here, signature and payload included."
                />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {sortedEvents.map((event) => (
                    <WebhookRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* invoice sheet */}
      <Sheet
        open={selectedBill !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBillId(null);
        }}
      >
        <SheetContent className="max-w-lg">
          {selectedBill ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  Invoice <span className="numeric">{selectedBill.billNumber}</span>
                </SheetTitle>
                <SheetDescription>
                  {STATUS_LABEL[selectedBill.status]} ·{" "}
                  {STAMP_FMT.format(new Date(selectedBill.createdAt))}
                </SheetDescription>
              </SheetHeader>

              <SheetBody>
                <BillInvoice
                  bill={selectedBill}
                  payment={paymentByBillId.get(selectedBill.id) ?? null}
                  settings={settings}
                  cashier={staffById.get(selectedBill.cashierId) ?? null}
                />
              </SheetBody>

              <SheetFooter>
                {selectedBill.status === "PAID" && canCancel ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="max-sm:h-11"
                    onClick={() => setCancelOpen(true)}
                    leftIcon={<Warning size={14} weight="fill" />}
                  >
                    Cancel this bill
                  </Button>
                ) : null}
                {selectedBill.status === "PAID" && !canCancel ? (
                  <span className="mr-auto text-[0.75rem] text-text-tertiary">
                    Only an owner or pharmacist can reverse a settled bill.
                  </span>
                ) : null}
                <Button variant="secondary" size="sm" asChild rightIcon={<ArrowSquareOut size={14} />}>
                  <Link href="/reports">See the fee cost</Link>
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* cancellation confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Cancel bill{" "}
              <span className="numeric">{selectedBill ? selectedBill.billNumber : ""}</span>?
            </DialogTitle>
            <DialogDescription>
              Every line on this bill goes back onto the shelf. The stock is returned by writing
              one SALE_REVERSAL movement per line into the ledger, so the batch quantities and the
              movement history stay in agreement. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            {selectedBill ? (
              <div className="rounded-[var(--radius-md)] border border-border bg-bg-sunken p-3">
                <p className="text-[0.8125rem] text-text-secondary">
                  Returning <span className="numeric font-medium text-text">
                    {selectedBill.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>{" "}
                  units across{" "}
                  <span className="numeric font-medium text-text">
                    {selectedBill.items.length}
                  </span>{" "}
                  lines, worth{" "}
                  <span className="numeric font-medium text-text">
                    {formatPaise(selectedBill.totalPaise)}
                  </span>
                  .
                </p>
              </div>
            ) : null}
            <Input
              label="Reason"
              placeholder="Customer returned the strip unopened"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              helperText="Recorded on every reversal movement, so the ledger says why."
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => setCancelOpen(false)}
            >
              Keep the bill
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={confirmCancel}
            >
              Cancel bill and return stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
