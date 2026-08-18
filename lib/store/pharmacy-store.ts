"use client";

/**
 * The whole "backend" of the demo.
 *
 * There is no database. This store is the system of record: catalogue, stock,
 * ledger, bills, payments and gateway events all live here and are persisted to
 * localStorage. Everything that would normally be a transaction on the server is
 * therefore a single `set()` call — the atomicity of stock commit + idempotency
 * flag depends on that, so never split a commit across two `set()` calls.
 */

import { useMemo, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { buildSeed, signPayload } from "../domain/seed";
import { buildUpiUri, computeFees } from "../domain/money";
import { baseRoleFor, builtInRoles } from "../domain/capabilities";
import {
  computeCartTotals,
  computeLineTotals,
  fefoBatch,
  isExpired,
  type CartTotals,
} from "../domain/selectors";
import type {
  CustomRole,
  Batch,
  Bill,
  BillItem,
  Category,
  FeeConfig,
  Medicine,
  Payment,
  PaymentMethod,
  ShopSettings,
  Staff,
  StockMovement,
  Supplier,
  WebhookEvent,
} from "../domain/types";
import type { CartLine } from "../domain/types";

export const PERSIST_KEY = "meridian-pharmacy-demo-v1";
const PERSIST_VERSION = 2;

// ─────────────────────────── ids ───────────────────────────

/**
 * Runtime ids only. Seed ids are stable slugs; these are only ever minted in
 * response to a user action, i.e. after hydration, so a non-deterministic
 * timestamp here cannot cause a hydration mismatch.
 */
let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36).padStart(2, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── result type ───────────────────────────

/**
 * Cart mutations can legitimately fail (expired lot, not enough on hand) and the
 * counter needs the reason to show in a toast — so they return a discriminated
 * result instead of throwing or silently doing nothing.
 */
export type CartResult = { ok: true; lineId: string } | { ok: false; reason: string };

function fail(reason: string): CartResult {
  return { ok: false, reason };
}

// ─────────────────────────── state ───────────────────────────

export interface CartMeta {
  customerName?: string;
  customerPhone?: string;
  doctorName?: string;
  prescriptionRef?: string;
}

export interface PharmacyState {
  categories: Category[];
  suppliers: Supplier[];
  staff: Staff[];
  roles: CustomRole[];
  medicines: Medicine[];
  batches: Batch[];
  movements: StockMovement[];
  bills: Bill[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
  settings: ShopSettings;
  feeConfig: FeeConfig;

  currentStaffId: string | null;
  cart: CartLine[];
  cartMeta: CartMeta;
  activeBillId: string | null;
  hydrated: boolean;
}

export interface PharmacyActions {
  // session
  signIn: (staffId: string, pin: string) => boolean;
  signOut: () => void;

  // cart
  addToCart: (medicineId: string, batchId?: string, qty?: number) => CartResult;
  updateCartQty: (lineId: string, qty: number) => CartResult;
  setLineDiscount: (lineId: string, paise: number) => CartResult;
  setLineBatch: (lineId: string, batchId: string) => CartResult;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  setCartMeta: (patch: Partial<CartMeta>) => void;

  // billing
  createBill: (method: PaymentMethod) => Bill;
  createPayment: (billId: string) => Payment;
  settlePayment: (paymentId: string, outcome: "PAID" | "FAILED") => WebhookEvent;
  markCashPaid: (billId: string) => boolean;
  cancelBill: (billId: string, reason: string) => boolean;
  setActiveBill: (billId: string | null) => void;

  // catalogue & stock
  upsertMedicine: (medicine: Medicine) => void;
  upsertCategory: (category: Category) => void;
  upsertSupplier: (supplier: Supplier) => void;
  addBatch: (batch: Batch) => void;
  adjustStock: (batchId: string, delta: number, reason: string) => boolean;
  writeOffExpired: (batchId: string) => boolean;

  // roles
  upsertRole: (role: CustomRole) => { ok: true } | { ok: false; reason: string };
  deleteRole: (roleId: string) => { ok: true } | { ok: false; reason: string };

  // staff
  upsertStaff: (member: Staff) => { ok: true } | { ok: false; reason: string };
  setStaffActive: (staffId: string, isActive: boolean) => { ok: true } | { ok: false; reason: string };
  removeStaff: (staffId: string) => { ok: true } | { ok: false; reason: string };

  // config
  updateSettings: (patch: Partial<ShopSettings>) => void;
  updateFeeConfig: (patch: Partial<FeeConfig>) => void;

  // demo control
  resetDemo: () => void;
  markHydrated: () => void;
}

export type PharmacyStore = PharmacyState & PharmacyActions;

function freshState(): PharmacyState {
  const seed = buildSeed();
  return {
    categories: seed.categories,
    suppliers: seed.suppliers,
    staff: seed.staff,
    roles: builtInRoles(),
    medicines: seed.medicines,
    batches: seed.batches,
    movements: seed.movements,
    bills: seed.bills,
    payments: seed.payments,
    webhookEvents: seed.webhookEvents,
    settings: seed.settings,
    feeConfig: seed.feeConfig,
    currentStaffId: null,
    cart: [],
    cartMeta: {},
    activeBillId: null,
    hydrated: false,
  };
}

// ─────────────────────────── stock commit primitives ───────────────────────────

interface StockPatch {
  batches: Batch[];
  movements: StockMovement[];
}

/**
 * Decrement every lot named on the bill and append one SALE movement per line.
 *
 * Written as a pure function over the two collections so the caller can fold the
 * result into the SAME `set()` that flips `stockCommitted` — the flag and the
 * decrement must land together or the idempotency guard is a lie.
 */
function applySaleCommit(
  batches: Batch[],
  movements: StockMovement[],
  bill: Bill,
  at: string,
): StockPatch {
  const byId = new Map(batches.map((b) => [b.id, b]));
  const updated = new Map<string, Batch>();
  const nextMovements = movements.slice();

  for (const item of bill.items) {
    const current = updated.get(item.batchId) ?? byId.get(item.batchId);
    // A lot deleted after the bill was raised: skip the decrement rather than
    // crash the settlement. The BillItem snapshot still carries the history.
    if (!current) continue;
    const quantity = Math.max(0, current.quantity - item.quantity);
    updated.set(item.batchId, { ...current, quantity });
    nextMovements.push({
      id: makeId("mov"),
      batchId: item.batchId,
      medicineId: item.medicineId,
      type: "SALE",
      quantity: -item.quantity,
      balanceAfter: quantity,
      billId: bill.id,
      staffId: bill.cashierId,
      createdAt: at,
    });
  }

  return {
    batches: batches.map((b) => updated.get(b.id) ?? b),
    movements: nextMovements,
  };
}

/** Mirror image of the commit, used when a settled bill is cancelled. */
function applySaleReversal(
  batches: Batch[],
  movements: StockMovement[],
  bill: Bill,
  reason: string,
  at: string,
): StockPatch {
  const byId = new Map(batches.map((b) => [b.id, b]));
  const updated = new Map<string, Batch>();
  const nextMovements = movements.slice();

  for (const item of bill.items) {
    const current = updated.get(item.batchId) ?? byId.get(item.batchId);
    if (!current) continue;
    const quantity = current.quantity + item.quantity;
    updated.set(item.batchId, { ...current, quantity });
    nextMovements.push({
      id: makeId("mov"),
      batchId: item.batchId,
      medicineId: item.medicineId,
      type: "SALE_REVERSAL",
      quantity: item.quantity,
      balanceAfter: quantity,
      reason,
      billId: bill.id,
      staffId: bill.cashierId,
      createdAt: at,
    });
  }

  return {
    batches: batches.map((b) => updated.get(b.id) ?? b),
    movements: nextMovements,
  };
}

/** Statuses from which a bill may still be settled. Cancelled/refunded may not. */
function isSettleable(bill: Bill): boolean {
  return bill.status === "DRAFT" || bill.status === "AWAITING_PAYMENT";
}

// ─────────────────────────── storage ───────────────────────────

/** SSR has no localStorage; a noop keeps `persist` from warning on the server. */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// ─────────────────────────── store ───────────────────────────

export const usePharmacyStore = create<PharmacyStore>()(
  persist(
    (set, get) => ({
      ...freshState(),

      // ── session ──

      signIn: (staffId, pin) => {
        const member = get().staff.find((s) => s.id === staffId);
        if (!member || !member.isActive || member.pin !== pin) return false;
        set({ currentStaffId: member.id });
        return true;
      },

      signOut: () => set({ currentStaffId: null, activeBillId: null }),

      // ── cart ──

      addToCart: (medicineId, batchId, qty = 1) => {
        const quantity = Math.max(1, Math.trunc(qty));
        const state = get();
        const now = new Date();

        const medicine = state.medicines.find((m) => m.id === medicineId);
        if (!medicine) return fail("That medicine is no longer in the catalogue.");
        if (!medicine.isActive) return fail(`${medicine.name} is de-listed.`);

        // No lot named → pick FEFO. Picking the earliest-expiring sellable lot is
        // what a pharmacist does by hand; it stops long-dated stock from hiding
        // short-dated stock until it becomes a write-off.
        const batch = batchId
          ? state.batches.find((b) => b.id === batchId && b.medicineId === medicineId)
          : fefoBatch(medicineId, state.batches, now);

        if (!batch) {
          return fail(
            batchId
              ? "That batch does not belong to this medicine."
              : `${medicine.name} has no sellable stock.`,
          );
        }
        if (isExpired(batch, now)) {
          return fail(`Batch ${batch.batchNumber} expired on ${batch.expiryDate}.`);
        }
        if (batch.quantity <= 0) {
          return fail(`Batch ${batch.batchNumber} is out of stock.`);
        }

        const existing = state.cart.find(
          (line) => line.medicineId === medicineId && line.batchId === batch.id,
        );
        const desired = (existing?.quantity ?? 0) + quantity;
        if (desired > batch.quantity) {
          return fail(
            `Only ${batch.quantity} ${medicine.unitLabel}(s) on hand in batch ${batch.batchNumber}.`,
          );
        }

        if (existing) {
          set({
            cart: state.cart.map((line) =>
              line.id === existing.id ? { ...line, quantity: desired } : line,
            ),
          });
          return { ok: true, lineId: existing.id };
        }

        const lineId = makeId("cl");
        set({
          cart: [
            ...state.cart,
            { id: lineId, medicineId, batchId: batch.id, quantity, discountPaise: 0 },
          ],
        });
        return { ok: true, lineId };
      },

      updateCartQty: (lineId, qty) => {
        const state = get();
        const line = state.cart.find((l) => l.id === lineId);
        if (!line) return fail("That line is no longer in the cart.");

        const quantity = Math.trunc(qty);
        if (quantity <= 0) {
          set({ cart: state.cart.filter((l) => l.id !== lineId) });
          return { ok: true, lineId };
        }

        const batch = state.batches.find((b) => b.id === line.batchId);
        if (!batch) return fail("That batch no longer exists.");
        if (quantity > batch.quantity) {
          return fail(`Only ${batch.quantity} on hand in batch ${batch.batchNumber}.`);
        }

        set({
          cart: state.cart.map((l) => (l.id === lineId ? { ...l, quantity } : l)),
        });
        return { ok: true, lineId };
      },

      setLineDiscount: (lineId, paise) => {
        const state = get();
        const line = state.cart.find((l) => l.id === lineId);
        if (!line) return fail("That line is no longer in the cart.");
        const batch = state.batches.find((b) => b.id === line.batchId);
        if (!batch) return fail("That batch no longer exists.");

        // A per-unit discount larger than the unit price would invert the line.
        const ceiling = Math.min(batch.sellingPaise, batch.mrpPaise);
        const discountPaise = Math.max(0, Math.min(Math.round(paise), ceiling));

        set({
          cart: state.cart.map((l) => (l.id === lineId ? { ...l, discountPaise } : l)),
        });
        return { ok: true, lineId };
      },

      setLineBatch: (lineId, batchId) => {
        const state = get();
        const now = new Date();
        const line = state.cart.find((l) => l.id === lineId);
        if (!line) return fail("That line is no longer in the cart.");

        const batch = state.batches.find((b) => b.id === batchId);
        if (!batch) return fail("Unknown batch.");
        if (batch.medicineId !== line.medicineId) {
          return fail("That batch belongs to a different medicine.");
        }
        if (isExpired(batch, now)) {
          return fail(`Batch ${batch.batchNumber} expired on ${batch.expiryDate}.`);
        }
        if (batch.quantity < line.quantity) {
          return fail(`Batch ${batch.batchNumber} has only ${batch.quantity} on hand.`);
        }

        set({
          cart: state.cart.map((l) => (l.id === lineId ? { ...l, batchId } : l)),
        });
        return { ok: true, lineId };
      },

      removeFromCart: (lineId) =>
        set({ cart: get().cart.filter((l) => l.id !== lineId) }),

      clearCart: () => set({ cart: [], cartMeta: {} }),

      setCartMeta: (patch) => set({ cartMeta: { ...get().cartMeta, ...patch } }),

      // ── billing ──

      createBill: (method) => {
        const state = get();
        if (state.cart.length === 0) {
          throw new Error("createBill: the cart is empty.");
        }
        const cashierId = state.currentStaffId;
        if (!cashierId) {
          throw new Error("createBill: no staff member is signed in.");
        }

        const totals = computeCartTotals(
          state.cart,
          state.medicines,
          state.batches,
          state.feeConfig,
        );

        // Cash never touches a gateway, so there is no cut to gross up. Only
        // card/UPI carry the convenience fee.
        const convenienceFeePaise = method === "CASH" ? 0 : totals.convenienceFeePaise;

        const medicineById = new Map(state.medicines.map((m) => [m.id, m]));
        const batchById = new Map(state.batches.map((b) => [b.id, b]));

        const items: BillItem[] = [];
        for (const line of state.cart) {
          const medicine = medicineById.get(line.medicineId);
          const batch = batchById.get(line.batchId);
          if (!medicine || !batch) continue;
          const lineTotals = computeLineTotals(line, medicine, batch);
          // Snapshot everything: editing the SKU or the lot tomorrow must not
          // rewrite an invoice that has already been handed to a customer.
          items.push({
            id: makeId("bli"),
            medicineId: medicine.id,
            batchId: batch.id,
            nameSnapshot: medicine.name,
            genericSnapshot: medicine.genericName,
            batchNumberSnapshot: batch.batchNumber,
            expirySnapshot: batch.expiryDate,
            hsnSnapshot: medicine.hsnCode,
            unitLabel: medicine.unitLabel,
            quantity: line.quantity,
            mrpPaise: lineTotals.mrpPaise,
            unitPricePaise: lineTotals.unitPricePaise,
            discountPaise: lineTotals.discountPaise,
            gstBps: medicine.gstBps,
            taxPaise: lineTotals.taxPaise,
            lineTotalPaise: lineTotals.lineTotalPaise,
          });
        }

        const invoiceCounter = state.settings.invoiceCounter + 1;
        const bill: Bill = {
          id: makeId("bill"),
          billNumber: `${state.settings.invoicePrefix}${String(invoiceCounter).padStart(5, "0")}`,
          status: method === "CASH" ? "DRAFT" : "AWAITING_PAYMENT",
          customerName: state.cartMeta.customerName,
          customerPhone: state.cartMeta.customerPhone,
          doctorName: state.cartMeta.doctorName,
          prescriptionRef: state.cartMeta.prescriptionRef,
          items,
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          taxPaise: totals.taxPaise,
          roundOffPaise: totals.roundOffPaise,
          totalPaise: totals.totalPaise,
          convenienceFeePaise,
          payablePaise: totals.totalPaise + convenienceFeePaise,
          method,
          cashierId,
          // Nothing is reserved yet. Stock moves only at settlement.
          stockCommitted: false,
          createdAt: nowIso(),
        };

        set({
          bills: [...state.bills, bill],
          settings: { ...state.settings, invoiceCounter },
          activeBillId: bill.id,
          cart: [],
          cartMeta: {},
        });

        return bill;
      },

      createPayment: (billId) => {
        const state = get();
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) throw new Error(`createPayment: unknown bill ${billId}`);

        const paymentId = makeId("pay");
        const createdAt = new Date();
        const payment: Payment = {
          id: paymentId,
          billId: bill.id,
          provider: "mock",
          status: "CREATED",
          amountPaise: bill.payablePaise,
          // Filled in from the settlement event, exactly as a real reconciliation
          // would: the shop learns the fee when the gateway reports it.
          gatewayFeePaise: 0,
          netPaise: 0,
          providerQrId: `qr_${paymentId}`,
          upiUri: buildUpiUri({
            vpa: state.settings.upiVpa,
            payeeName: state.settings.upiPayeeName,
            amountPaise: bill.payablePaise,
            transactionRef: bill.billNumber,
            note: `Bill ${bill.billNumber}`,
          }),
          expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
          createdAt: createdAt.toISOString(),
        };

        set({ payments: [...state.payments, payment], activeBillId: bill.id });
        return payment;
      },

      /**
       * The webhook simulation. Order of operations here is the whole point of
       * the demo, so it is fixed:
       *
       *   1. record the signed event BEFORE touching anything,
       *   2. check the idempotency flag,
       *   3. only then move money and stock,
       *   4. close the event out.
       */
      settlePayment: (paymentId, outcome) => {
        const state = get();
        const at = nowIso();

        const payment = state.payments.find((p) => p.id === paymentId);
        const bill = payment
          ? state.bills.find((b) => b.id === payment.billId)
          : undefined;

        const eventType = outcome === "PAID" ? "payment.captured" : "payment.failed";
        const payload = {
          event: eventType,
          payment_id: payment?.providerPaymentId ?? `mock_pay_${paymentId}`,
          bill_id: payment?.billId ?? null,
          amount: payment?.amountPaise ?? 0,
          currency: "INR",
          vpa: payment?.payerVpa ?? "customer@upi",
        };
        const raw = JSON.stringify(payload);

        const event: WebhookEvent = {
          id: makeId("whk"),
          provider: "mock",
          // The provider's own event id is the idempotency key a real integration
          // would dedupe on; ours is derived from the payment plus the outcome.
          eventId: `evt_${paymentId}_${outcome.toLowerCase()}`,
          eventType,
          status: "RECEIVED",
          signature: signPayload(raw),
          payload,
          receivedAt: at,
        };

        if (!payment || !bill) {
          const failed: WebhookEvent = {
            ...event,
            status: "FAILED",
            note: "No payment or bill matches this event.",
            processedAt: at,
          };
          set({ webhookEvents: [...state.webhookEvents, failed] });
          return failed;
        }

        // ── REPLAY GUARD ──
        // Gateways retry. The same capture can arrive two or three times, and the
        // second delivery must not decrement stock again. `stockCommitted` is the
        // only thing standing between a retry and a phantom sale, so it is checked
        // before any mutation and the event is filed as IGNORED with a reason.
        if (bill.stockCommitted || !isSettleable(bill)) {
          const ignored: WebhookEvent = {
            ...event,
            status: "IGNORED",
            note: bill.stockCommitted
              ? `Replay ignored — stock already committed for ${bill.billNumber}.`
              : `Replay ignored — ${bill.billNumber} is ${bill.status}.`,
            processedAt: at,
          };
          set({ webhookEvents: [...state.webhookEvents, ignored] });
          return ignored;
        }

        if (outcome === "FAILED") {
          const processed: WebhookEvent = { ...event, status: "PROCESSED", processedAt: at };
          set({
            payments: state.payments.map((p) =>
              p.id === paymentId ? { ...p, status: "FAILED" } : p,
            ),
            // The bill stays open so the cashier can re-present the QR or take cash.
            webhookEvents: [...state.webhookEvents, processed],
          });
          return processed;
        }

        const fees = computeFees(bill.totalPaise, state.feeConfig);
        const gatewayFeePaise = fees.gatewayFeePaise;

        const paidBill: Bill = {
          ...bill,
          status: "PAID",
          paidAt: at,
          stockCommitted: true,
        };
        const patch = applySaleCommit(state.batches, state.movements, paidBill, at);
        const processed: WebhookEvent = { ...event, status: "PROCESSED", processedAt: at };

        // One atomic write: stock, ledger, bill flag and event all land together.
        set({
          payments: state.payments.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  status: "PAID",
                  gatewayFeePaise,
                  netPaise: p.amountPaise - gatewayFeePaise,
                  providerPaymentId: p.providerPaymentId ?? `mock_pay_${paymentId}`,
                  paidAt: at,
                }
              : p,
          ),
          bills: state.bills.map((b) => (b.id === paidBill.id ? paidBill : b)),
          batches: patch.batches,
          movements: patch.movements,
          webhookEvents: [...state.webhookEvents, processed],
        });

        return processed;
      },

      markCashPaid: (billId) => {
        const state = get();
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill) return false;
        // Same guard as the webhook path: a double-tap on "Cash received" is the
        // counter's version of a gateway retry.
        if (bill.stockCommitted || !isSettleable(bill)) return false;

        const at = nowIso();
        const paidBill: Bill = {
          ...bill,
          status: "PAID",
          method: "CASH",
          // Cash carries no gateway cut, so the customer pays the bill exactly.
          convenienceFeePaise: 0,
          payablePaise: bill.totalPaise,
          paidAt: at,
          stockCommitted: true,
        };
        const patch = applySaleCommit(state.batches, state.movements, paidBill, at);

        set({
          bills: state.bills.map((b) => (b.id === billId ? paidBill : b)),
          batches: patch.batches,
          movements: patch.movements,
        });
        return true;
      },

      cancelBill: (billId, reason) => {
        const state = get();
        const bill = state.bills.find((b) => b.id === billId);
        if (!bill || bill.status === "CANCELLED") return false;

        const at = nowIso();
        const cancelled: Bill = {
          ...bill,
          status: "CANCELLED",
          cancelledAt: at,
          // Stock is back on the shelf, so the flag has to go back too — and the
          // status check in the settle path stops a late webhook re-committing it.
          stockCommitted: false,
        };

        if (bill.stockCommitted) {
          const patch = applySaleReversal(state.batches, state.movements, bill, reason, at);
          set({
            bills: state.bills.map((b) => (b.id === billId ? cancelled : b)),
            batches: patch.batches,
            movements: patch.movements,
            payments: state.payments.map((p) =>
              p.billId === billId && p.status !== "PAID" ? { ...p, status: "CANCELLED" } : p,
            ),
            activeBillId: state.activeBillId === billId ? null : state.activeBillId,
          });
          return true;
        }

        set({
          bills: state.bills.map((b) => (b.id === billId ? cancelled : b)),
          payments: state.payments.map((p) =>
            p.billId === billId && p.status !== "PAID" ? { ...p, status: "CANCELLED" } : p,
          ),
          activeBillId: state.activeBillId === billId ? null : state.activeBillId,
        });
        return true;
      },

      setActiveBill: (billId) => set({ activeBillId: billId }),

      // ── catalogue & stock ──

      upsertMedicine: (medicine) => {
        const list = get().medicines;
        const exists = list.some((m) => m.id === medicine.id);
        set({
          medicines: exists
            ? list.map((m) => (m.id === medicine.id ? medicine : m))
            : [...list, medicine],
        });
      },

      upsertCategory: (category) => {
        const list = get().categories;
        const exists = list.some((c) => c.id === category.id);
        set({
          categories: exists
            ? list.map((c) => (c.id === category.id ? category : c))
            : [...list, category],
        });
      },

      upsertSupplier: (supplier) => {
        const list = get().suppliers;
        const exists = list.some((s) => s.id === supplier.id);
        set({
          suppliers: exists
            ? list.map((s) => (s.id === supplier.id ? supplier : s))
            : [...list, supplier],
        });
      },

      addBatch: (batch) => {
        const state = get();
        if (state.batches.some((b) => b.id === batch.id)) return;
        // Goods inward opens the ledger for this lot.
        const movement: StockMovement = {
          id: makeId("mov"),
          batchId: batch.id,
          medicineId: batch.medicineId,
          type: "PURCHASE",
          quantity: batch.quantity,
          balanceAfter: batch.quantity,
          reason: batch.invoiceRef ? `Goods inward ${batch.invoiceRef}` : "Goods inward",
          staffId: state.currentStaffId ?? undefined,
          createdAt: batch.receivedAt || nowIso(),
        };
        set({
          batches: [...state.batches, batch],
          movements: [...state.movements, movement],
        });
      },

      adjustStock: (batchId, delta, reason) => {
        const state = get();
        const batch = state.batches.find((b) => b.id === batchId);
        if (!batch || delta === 0) return false;

        const quantity = Math.max(0, batch.quantity + Math.trunc(delta));
        // Record the movement that actually happened, not the one that was asked
        // for — clamping at zero must not desync the ledger from the cache.
        const applied = quantity - batch.quantity;
        if (applied === 0) return false;

        set({
          batches: state.batches.map((b) => (b.id === batchId ? { ...b, quantity } : b)),
          movements: [
            ...state.movements,
            {
              id: makeId("mov"),
              batchId,
              medicineId: batch.medicineId,
              type: "ADJUSTMENT",
              quantity: applied,
              balanceAfter: quantity,
              reason,
              staffId: state.currentStaffId ?? undefined,
              createdAt: nowIso(),
            },
          ],
        });
        return true;
      },

      writeOffExpired: (batchId) => {
        const state = get();
        const batch = state.batches.find((b) => b.id === batchId);
        if (!batch || batch.quantity <= 0) return false;

        set({
          batches: state.batches.map((b) => (b.id === batchId ? { ...b, quantity: 0 } : b)),
          movements: [
            ...state.movements,
            {
              id: makeId("mov"),
              batchId,
              medicineId: batch.medicineId,
              type: "EXPIRY_WRITE_OFF",
              quantity: -batch.quantity,
              balanceAfter: 0,
              reason: `Expired ${batch.expiryDate} — batch ${batch.batchNumber}`,
              staffId: state.currentStaffId ?? undefined,
              createdAt: nowIso(),
            },
          ],
        });
        return true;
      },

      // ── config ──

      upsertRole: (role) => {
        // Built-ins are locked. Letting someone strip `staff.manage` off Owner
        // is a one-click way to lock every person out of the shop for good.
        const existing = get().roles.find((r) => r.id === role.id);
        if (existing?.isBuiltIn) {
          return { ok: false, reason: "Built-in roles cannot be edited. Duplicate it instead." };
        }
        if (!role.name.trim()) return { ok: false, reason: "Give the role a name." };
        if (role.capabilities.length === 0) {
          return { ok: false, reason: "A role with no permissions cannot do anything. Tick at least one." };
        }
        const nameClash = get().roles.some(
          (r) => r.id !== role.id && r.name.trim().toLowerCase() === role.name.trim().toLowerCase(),
        );
        if (nameClash) return { ok: false, reason: "A role with that name already exists." };

        const normalised: CustomRole = {
          ...role,
          name: role.name.trim(),
          isBuiltIn: false,
          baseRole: baseRoleFor(role.capabilities),
        };

        set((state) => ({
          roles: existing
            ? state.roles.map((r) => (r.id === role.id ? normalised : r))
            : [...state.roles, normalised],
          // Anyone already on this role inherits the change immediately, and
          // their coarse role is realigned so nav and the cost guard agree.
          staff: state.staff.map((member) =>
            member.roleId === normalised.id ? { ...member, role: normalised.baseRole } : member,
          ),
        }));
        return { ok: true };
      },

      deleteRole: (roleId) => {
        const role = get().roles.find((r) => r.id === roleId);
        if (!role) return { ok: false, reason: "That role no longer exists." };
        if (role.isBuiltIn) return { ok: false, reason: "Built-in roles cannot be deleted." };

        const holders = get().staff.filter((s) => s.roleId === roleId);
        if (holders.length > 0) {
          const names = holders.map((h) => h.name).join(", ");
          return {
            ok: false,
            reason: `${names} still ${holders.length === 1 ? "has" : "have"} this role. Move ${holders.length === 1 ? "them" : "them"} to another role first.`,
          };
        }

        set((state) => ({ roles: state.roles.filter((r) => r.id !== roleId) }));
        return { ok: true };
      },

      upsertStaff: (member) => {
        const existing = get().staff.find((s) => s.id === member.id);

        // PINs are how the till is handed over, so a collision would silently
        // sign in the wrong person and misattribute every bill they ring.
        const pinClash = get().staff.some((s) => s.id !== member.id && s.pin === member.pin);
        if (pinClash) return { ok: false, reason: "Another staff member already uses that PIN." };

        if (!/^\d{4}$/.test(member.pin)) {
          return { ok: false, reason: "A PIN must be exactly four digits." };
        }

        // The shop must never be left without someone who can change settings,
        // add staff or read margins. Demoting the last owner locks everyone out.
        if (existing?.role === "OWNER" && member.role !== "OWNER") {
          const owners = get().staff.filter((s) => s.role === "OWNER" && s.isActive);
          if (owners.length <= 1) {
            return { ok: false, reason: "This is the only owner. Promote someone else first." };
          }
        }

        // A custom role carries its own base role; keeping the two in step
        // means nav gating and the cost-price guard never disagree with the
        // capability check.
        const assigned = member.roleId ? get().roles.find((r) => r.id === member.roleId) : undefined;
        const reconciled: Staff = assigned ? { ...member, role: assigned.baseRole } : member;

        set((state) => ({
          staff: existing
            ? state.staff.map((s) => (s.id === reconciled.id ? reconciled : s))
            : [...state.staff, reconciled],
        }));
        return { ok: true };
      },

      setStaffActive: (staffId, isActive) => {
        const member = get().staff.find((s) => s.id === staffId);
        if (!member) return { ok: false, reason: "That staff member no longer exists." };

        if (!isActive) {
          if (member.role === "OWNER") {
            const owners = get().staff.filter((s) => s.role === "OWNER" && s.isActive);
            if (owners.length <= 1) {
              return { ok: false, reason: "This is the only active owner. Promote someone else first." };
            }
          }
        }

        set((state) => ({
          staff: state.staff.map((s) => (s.id === staffId ? { ...s, isActive } : s)),
          // Someone deactivated mid-shift is signed out immediately rather than
          // being left holding an open till.
          currentStaffId:
            !isActive && state.currentStaffId === staffId ? null : state.currentStaffId,
        }));
        return { ok: true };
      },

      removeStaff: (staffId) => {
        const member = get().staff.find((s) => s.id === staffId);
        if (!member) return { ok: false, reason: "That staff member no longer exists." };

        // Bills name their cashier. Deleting that person would orphan the
        // attribution on every invoice they ever rang, so past staff are
        // deactivated instead of erased.
        const hasHistory = get().bills.some((b) => b.cashierId === staffId);
        if (hasHistory) {
          return {
            ok: false,
            reason: "This person has rung up bills. Deactivate them instead so the invoices keep their cashier.",
          };
        }
        if (member.role === "OWNER") {
          const owners = get().staff.filter((s) => s.role === "OWNER");
          if (owners.length <= 1) return { ok: false, reason: "The shop needs at least one owner." };
        }

        set((state) => ({
          staff: state.staff.filter((s) => s.id !== staffId),
          currentStaffId: state.currentStaffId === staffId ? null : state.currentStaffId,
        }));
        return { ok: true };
      },

      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      updateFeeConfig: (patch) => set({ feeConfig: { ...get().feeConfig, ...patch } }),

      // ── demo control ──

      resetDemo: () => set({ ...freshState(), hydrated: true }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.localStorage,
      ),
      // `hydrated` describes this runtime, not the data — persisting it would
      // make a reloaded page claim it had rehydrated before it actually had.
      partialize: (state) => ({
        categories: state.categories,
        suppliers: state.suppliers,
        staff: state.staff,
        roles: state.roles,
        medicines: state.medicines,
        batches: state.batches,
        movements: state.movements,
        bills: state.bills,
        payments: state.payments,
        webhookEvents: state.webhookEvents,
        settings: state.settings,
        feeConfig: state.feeConfig,
        currentStaffId: state.currentStaffId,
        cart: state.cart,
        cartMeta: state.cartMeta,
        activeBillId: state.activeBillId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

// ─────────────────────────── hooks ───────────────────────────

/**
 * True once the persisted state has been read back from localStorage.
 *
 * Deliberately starts false on both the server and the first client render, so a
 * component that gates on it renders identical markup on both passes — that is
 * what stops the hydration flash, not the store flag alone.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => usePharmacyStore.persist.onFinishHydration(onStoreChange),
    () => usePharmacyStore.persist.hasHydrated(),
    // Server snapshot is pinned to false; React then re-renders once the real
    // client snapshot disagrees, instead of reporting a hydration mismatch.
    () => false,
  );
}

/**
 * Cart totals as a memoised value. Provided as a hook rather than a store getter
 * because the totals object is freshly allocated on every call — returning it
 * straight out of a zustand selector would fail the Object.is check every render
 * and loop forever.
 */
export function useCartTotals(): CartTotals {
  const cart = usePharmacyStore((s) => s.cart);
  const medicines = usePharmacyStore((s) => s.medicines);
  const batches = usePharmacyStore((s) => s.batches);
  const feeConfig = usePharmacyStore((s) => s.feeConfig);

  return useMemo(
    () => computeCartTotals(cart, medicines, batches, feeConfig),
    [cart, medicines, batches, feeConfig],
  );
}

/** The signed-in staff member, or null. */
export function useCurrentStaff(): Staff | null {
  const staffId = usePharmacyStore((s) => s.currentStaffId);
  const staff = usePharmacyStore((s) => s.staff);
  return useMemo(
    () => (staffId ? (staff.find((s) => s.id === staffId) ?? null) : null),
    [staffId, staff],
  );
}
