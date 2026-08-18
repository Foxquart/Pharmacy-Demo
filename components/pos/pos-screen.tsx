"use client";

import * as React from "react";
import { toast } from "sonner";

import { CAN_SEE_COST, ROLE_LABEL } from "@/components/app/nav";
import { rupeesToPaise } from "@/lib/domain/money";
import { lookupByBarcode, searchMedicines } from "@/lib/domain/selectors";
import type { Medicine } from "@/lib/domain/types";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import { useHotkeys } from "@/lib/hooks/use-hotkeys";
import {
  useCartTotals,
  useCurrentStaff,
  useHydrated,
  usePharmacyStore,
} from "@/lib/store/pharmacy-store";

import { CartTable, focusCartLine } from "./cart-table";
import { CounterSearch, ScanHint } from "./counter-search";
import { KeyboardStrip } from "./keyboard-legend";
import { PaymentDialog, type CheckoutState } from "./payment-dialog";
import { PosSkeleton } from "./pos-skeleton";
import { PrescriptionGate } from "./prescription-gate";
import { MobilePayBar, MobileTotals, TotalsRail, type CounterMethod } from "./totals-rail";

export function PosScreen() {
  const hydrated = useHydrated();
  // Everything below reads persisted state and today's date. Mounting it only
  // after rehydration is what keeps the first paint identical on both passes.
  if (!hydrated) return <PosSkeleton />;
  return <PosCounter />;
}

function PosCounter() {
  const medicines = usePharmacyStore((state) => state.medicines);
  const batches = usePharmacyStore((state) => state.batches);
  const cart = usePharmacyStore((state) => state.cart);
  const cartMeta = usePharmacyStore((state) => state.cartMeta);
  const settings = usePharmacyStore((state) => state.settings);
  const feeConfig = usePharmacyStore((state) => state.feeConfig);

  const addToCart = usePharmacyStore((state) => state.addToCart);
  const updateCartQty = usePharmacyStore((state) => state.updateCartQty);
  const setLineBatch = usePharmacyStore((state) => state.setLineBatch);
  const setLineDiscount = usePharmacyStore((state) => state.setLineDiscount);
  const removeFromCart = usePharmacyStore((state) => state.removeFromCart);
  const setCartMeta = usePharmacyStore((state) => state.setCartMeta);
  const createBill = usePharmacyStore((state) => state.createBill);
  const createPayment = usePharmacyStore((state) => state.createPayment);
  const markCashPaid = usePharmacyStore((state) => state.markCashPaid);
  const setActiveBill = usePharmacyStore((state) => state.setActiveBill);

  const totals = useCartTotals();
  const staff = useCurrentStaff();
  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  const searchRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const [activeLineId, setActiveLineId] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState<CounterMethod>("UPI");
  const [tendered, setTendered] = React.useState("");
  const [checkout, setCheckout] = React.useState<CheckoutState | null>(null);
  const [changePaise, setChangePaise] = React.useState<number | null>(null);

  // Expiry is a calendar fact, so "now" only needs to move on the minute. A
  // ticking clock in the render path would rebuild every batch list every second.
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const warningDays = settings.expiryWarningDays;

  const results = React.useMemo(
    () => searchMedicines(query, medicines, { limit: 8 }),
    [query, medicines],
  );
  // Derived, not synchronised: a shorter result set can never leave the
  // highlight pointing past the end of the list for a frame.
  const highlightIndex = highlight < results.length ? highlight : 0;

  const focusSearch = React.useCallback(() => {
    const element = searchRef.current;
    if (!element) return;
    element.focus();
    element.select();
  }, []);

  React.useEffect(() => {
    focusSearch();
  }, [focusSearch]);

  const tenderedPaise = React.useMemo(() => {
    const parsed = Number(tendered.trim());
    return Number.isFinite(parsed) && parsed > 0 ? rupeesToPaise(parsed) : 0;
  }, [tendered]);

  // ── cart mutations ──────────────────────────────────────────────────────
  // Every one of these can legitimately refuse. The reason always reaches the
  // operator, because a line that silently does not appear is how a customer
  // walks out with stock the system thinks is still on the shelf.

  const handleAdd = React.useCallback(
    (medicineId: string) => {
      const result = addToCart(medicineId);
      if (!result.ok) {
        toast.error("Not added to the cart", { description: result.reason });
        return;
      }
      setQuery("");
      setHighlight(0);
      setActiveLineId(result.lineId);
      focusSearch();
    },
    [addToCart, focusSearch],
  );

  const handleScan = React.useCallback(
    (code: string) => {
      setQuery("");
      const medicine = lookupByBarcode(code, medicines);
      if (!medicine) {
        toast.error("Unknown barcode", {
          description: `Nothing in the catalogue carries ${code}. Add it in Inventory, or search by name.`,
        });
        return;
      }
      const result = addToCart(medicine.id);
      if (!result.ok) {
        toast.error(`Cannot sell ${medicine.name}`, { description: result.reason });
        return;
      }
      setActiveLineId(result.lineId);
      toast.success(`${medicine.name} added`, { description: medicine.genericName });
    },
    [addToCart, medicines],
  );

  // Hardware scanners are HID keyboards. Wiring this at the page level is what
  // lets a scan land with the operator's hands nowhere near the keyboard.
  useBarcodeScanner({ onScan: handleScan, enabled: checkout === null });

  const handleQty = React.useCallback(
    (lineId: string, quantity: number) => {
      const result = updateCartQty(lineId, quantity);
      if (!result.ok) toast.error("Quantity unchanged", { description: result.reason });
    },
    [updateCartQty],
  );

  const handleBatch = React.useCallback(
    (lineId: string, batchId: string) => {
      const result = setLineBatch(lineId, batchId);
      if (!result.ok) toast.error("Batch unchanged", { description: result.reason });
    },
    [setLineBatch],
  );

  const handleDiscount = React.useCallback(
    (lineId: string, paise: number) => {
      const result = setLineDiscount(lineId, paise);
      if (!result.ok) toast.error("Discount unchanged", { description: result.reason });
    },
    [setLineDiscount],
  );

  const handleRemove = React.useCallback(
    (lineId: string) => {
      removeFromCart(lineId);
      setActiveLineId((current) => (current === lineId ? null : current));
      focusSearch();
    },
    [removeFromCart, focusSearch],
  );

  const targetLineId = activeLineId ?? cart[cart.length - 1]?.id ?? null;

  const adjustActiveQty = React.useCallback(
    (delta: number) => {
      if (!targetLineId) return;
      const line = cart.find((candidate) => candidate.id === targetLineId);
      if (!line) return;
      setActiveLineId(line.id);
      handleQty(line.id, line.quantity + delta);
    },
    [cart, targetLineId, handleQty],
  );

  const removeActiveLine = React.useCallback(() => {
    if (!targetLineId) return;
    handleRemove(targetLineId);
  }, [targetLineId, handleRemove]);

  // ── prescription gate ───────────────────────────────────────────────────

  const rxMedicines = React.useMemo(() => {
    const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]));
    const required = new Map<string, Medicine>();
    for (const line of cart) {
      const medicine = byId.get(line.medicineId);
      if (medicine?.requiresPrescription) required.set(medicine.id, medicine);
    }
    return [...required.values()];
  }, [cart, medicines]);

  const prescriptionRef = cartMeta.prescriptionRef ?? "";
  const rxSatisfied = rxMedicines.length === 0 || prescriptionRef.trim().length > 0;

  const blockedReason = !staff
    ? "Sign in before raising a bill."
    : cart.length === 0
      ? "Scan or search to put something on the counter."
      : !rxSatisfied
        ? `Record the prescription for ${rxMedicines.map((medicine) => medicine.name).join(", ")} before billing.`
        : null;

  const canCheckout = blockedReason === null && checkout === null;

  // ── checkout ────────────────────────────────────────────────────────────

  const startCheckout = React.useCallback(
    (chosen: CounterMethod) => {
      if (checkout) return;
      if (!staff) {
        toast.error("Nobody is signed in", {
          description: "Every bill has to carry the cashier who rang it.",
        });
        return;
      }
      if (cart.length === 0) {
        toast.error("The cart is empty", { description: "Scan a pack to start a sale." });
        return;
      }
      if (!rxSatisfied) {
        toast.error("Prescription reference required", {
          description: `${rxMedicines.map((medicine) => medicine.name).join(", ")} cannot be dispensed without it.`,
        });
        return;
      }

      // createBill throws on an empty cart or a missing cashier. Both are gated
      // above, but the counter must never show a stack trace mid-queue.
      try {
        if (chosen === "CASH") {
          const change = tenderedPaise > 0 ? tenderedPaise - totals.totalPaise : null;
          const bill = createBill("CASH");
          const settled = markCashPaid(bill.id);
          if (!settled) {
            toast.error("That bill could not be settled", {
              description: "It is open under Payments. No stock has moved.",
            });
          }
          setChangePaise(change !== null && change > 0 ? change : null);
          setCheckout({ kind: "CASH", billId: bill.id });
          return;
        }

        const bill = createBill("UPI");
        const payment = createPayment(bill.id);
        setChangePaise(null);
        setCheckout({ kind: "UPI", billId: bill.id, paymentId: payment.id });
      } catch (error) {
        toast.error("Could not raise the bill", {
          description: error instanceof Error ? error.message : "Unknown error.",
        });
      }
    },
    [
      checkout,
      staff,
      cart.length,
      rxSatisfied,
      rxMedicines,
      tenderedPaise,
      totals.totalPaise,
      createBill,
      createPayment,
      markCashPaid,
    ],
  );

  const closeCheckout = React.useCallback(() => {
    setCheckout(null);
    setChangePaise(null);
    setActiveBill(null);
    setTendered("");
    setActiveLineId(null);
    setQuery("");
    focusSearch();
  }, [setActiveBill, focusSearch]);

  const regeneratePayment = React.useCallback(
    (billId: string) => {
      const payment = createPayment(billId);
      setCheckout({ kind: "UPI", billId, paymentId: payment.id });
    },
    [createPayment],
  );

  // ── keyboard ────────────────────────────────────────────────────────────

  const handleEscape = React.useCallback(() => {
    if (checkout) return; // the dialog owns Escape while it is open
    if (query.length > 0) {
      setQuery("");
      return;
    }
    setActiveLineId(null);
    focusSearch();
  }, [checkout, query, focusSearch]);

  useHotkeys({
    f2: () => focusSearch(),
    f4: () => {
      setMethod("CASH");
      startCheckout("CASH");
    },
    f8: () => {
      setMethod("UPI");
      startCheckout("UPI");
    },
    escape: handleEscape,
    "+": () => adjustActiveQty(1),
    "shift+=": () => adjustActiveQty(1),
    "=": () => adjustActiveQty(1),
    "-": () => adjustActiveQty(-1),
    delete: () => removeActiveLine(),
  });

  const enterCart = React.useCallback(() => {
    const target = targetLineId ?? cart[0]?.id;
    if (!target) return;
    setActiveLineId(target);
    focusCartLine(target);
  }, [targetLineId, cart]);

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      <section className="min-w-0 flex-1 px-4 pt-4 pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-5 lg:pt-5 lg:pb-8 xl:px-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.125rem] leading-tight font-medium tracking-[-0.02em] text-text">
              Counter
            </h1>
            <p className="text-[0.8125rem] text-text-secondary">
              {staff ? `${staff.name} · ${ROLE_LABEL[staff.role]}` : "No one signed in"} ·{" "}
              {settings.shopName}
            </p>
          </div>
          <KeyboardStrip className="hidden xl:flex" />
        </header>

        {/* Sticky under the header below `lg`: the operator's hands are on this
            field all shift, and the mobile keyboard must never be what hides
            it. At `lg` the wrapper is inert and the field sits exactly where it
            always did. */}
        <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-bg/95 px-4 pt-1 pb-2 backdrop-blur-md sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <CounterSearch
            inputRef={searchRef}
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              setHighlight(0);
            }}
            results={results}
            highlight={highlightIndex}
            onHighlight={setHighlight}
            onAdd={handleAdd}
            batches={batches}
            now={now}
            warningDays={warningDays}
            onEnterCart={enterCart}
            onEscape={handleEscape}
            onQuantityKey={adjustActiveQty}
            onDeleteKey={removeActiveLine}
          />
        </div>
        <ScanHint className="mt-2 max-lg:hidden" />

        {rxMedicines.length > 0 ? (
          <div className="mt-4">
            <PrescriptionGate
              medicines={rxMedicines}
              prescriptionRef={prescriptionRef}
              doctorName={cartMeta.doctorName ?? ""}
              onChange={(patch) => setCartMeta(patch)}
            />
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          <CartTable
            cart={cart}
            medicines={medicines}
            batches={batches}
            now={now}
            warningDays={warningDays}
            activeLineId={activeLineId}
            canSeeCost={canSeeCost}
            onActivate={setActiveLineId}
            onQty={handleQty}
            onBatch={handleBatch}
            onDiscount={handleDiscount}
            onRemove={handleRemove}
            onFocusSearch={focusSearch}
          />
        </div>

        <div className="mt-4 lg:hidden">
          <MobileTotals
            totals={totals}
            feeConfig={feeConfig}
            method={method}
            tendered={tendered}
            tenderedPaise={tenderedPaise}
            onTenderedChange={setTendered}
          />
        </div>

        <KeyboardStrip className="mt-4 hidden lg:flex xl:hidden" />
      </section>

      <aside className="hidden w-[20rem] shrink-0 border-l border-border bg-surface p-4 lg:sticky lg:top-14 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto xl:w-[22rem] xl:p-5">
        <TotalsRail
          totals={totals}
          feeConfig={feeConfig}
          method={method}
          onMethodChange={setMethod}
          tendered={tendered}
          tenderedPaise={tenderedPaise}
          onTenderedChange={setTendered}
          canCheckout={canCheckout}
          blockedReason={cart.length > 0 ? blockedReason : null}
          onCheckout={() => startCheckout(method)}
        />
      </aside>

      {cart.length > 0 ? (
        <MobilePayBar
          totals={totals}
          method={method}
          onMethodChange={setMethod}
          canCheckout={canCheckout}
          blockedReason={blockedReason}
          onCheckout={() => startCheckout(method)}
        />
      ) : null}

      <PaymentDialog
        checkout={checkout}
        changePaise={changePaise}
        onClose={closeCheckout}
        onNewSale={closeCheckout}
        onRegenerate={regeneratePayment}
      />
    </div>
  );
}
