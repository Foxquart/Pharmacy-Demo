/**
 * Pure read-model over the domain types.
 *
 * Nothing here imports the store — every function takes its inputs explicitly so
 * the pricing and FEFO rules can be unit-tested without a React tree or a
 * localStorage shim, and so the same code can run inside a selector, inside a
 * store action, or inside the seed builder.
 */

import {
  applyBps,
  computeFees,
  extractInclusiveTax,
  roundOffToRupee,
} from "./money";
import type {
  Batch,
  CartLine,
  DrugSchedule,
  ExpiryState,
  FeeConfig,
  Medicine,
  MovementType,
  StockState,
} from "./types";

// ─────────────────────────── time ───────────────────────────

const DAY_MS = 86_400_000;

/**
 * Whole calendar days between `now` and an ISO date, floored to UTC midnight on
 * both sides. Expiry is a calendar fact, not an instant: a batch stamped
 * "expires 2026-08-18" is good for the whole of the 18th, and comparing raw
 * timestamps would retire it at whatever hour the page happened to load.
 */
export function daysUntil(dateISO: string, now: Date): number {
  const target = Date.parse(dateISO);
  if (Number.isNaN(target)) return Number.NaN;
  return Math.floor(target / DAY_MS) - Math.floor(now.getTime() / DAY_MS);
}

// ─────────────────────────── state machines ───────────────────────────

/** Reorder level is the "one more order cycle" mark; a quarter of it is the panic mark. */
export function stockStateOf(totalQty: number, reorderLevel: number): StockState {
  if (totalQty <= 0) return "OUT";
  if (reorderLevel <= 0) return "OK";
  if (totalQty <= Math.ceil(reorderLevel * 0.25)) return "CRITICAL";
  if (totalQty <= reorderLevel) return "LOW";
  return "OK";
}

export function expiryStateOf(
  expiryDate: string,
  now: Date,
  warningDays: number,
): ExpiryState {
  const days = daysUntil(expiryDate, now);
  if (Number.isNaN(days)) return "OK";
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "CRITICAL";
  if (days <= warningDays) return "WARNING";
  return "OK";
}

export function isExpired(batch: Batch, now: Date): boolean {
  return daysUntil(batch.expiryDate, now) < 0;
}

// ─────────────────────────── stock ───────────────────────────

/**
 * On-hand quantity a customer could actually be sold today.
 *
 * Expired lots deliberately do NOT count: they are still physically on the shelf
 * and still carry a value for the write-off report, but counting them as stock
 * would hide a stock-out from the reorder screen — the exact failure this demo
 * is meant to make visible.
 */
export function totalStockFor(
  medicineId: string,
  batches: Batch[],
  now: Date = new Date(),
): number {
  let total = 0;
  for (const batch of batches) {
    if (batch.medicineId !== medicineId) continue;
    if (isExpired(batch, now)) continue;
    total += batch.quantity;
  }
  return total;
}

/** Includes expired lots. Used by the write-off / shrinkage views only. */
export function physicalStockFor(medicineId: string, batches: Batch[]): number {
  let total = 0;
  for (const batch of batches) {
    if (batch.medicineId === medicineId) total += batch.quantity;
  }
  return total;
}

/**
 * FEFO — First Expired, First Out. Pharmacies do not pick by receipt date the way
 * a warehouse does; the lot that dies first goes out first, otherwise short-dated
 * stock quietly ages into a write-off behind a long-dated lot of the same SKU.
 */
export function sellableBatches(
  medicineId: string,
  batches: Batch[],
  now: Date,
): Batch[] {
  return batches
    .filter(
      (b) => b.medicineId === medicineId && b.quantity > 0 && !isExpired(b, now),
    )
    .sort((a, b) => {
      const byExpiry = a.expiryDate.localeCompare(b.expiryDate);
      // Stable tiebreak on id so the auto-picked batch never flickers between renders.
      return byExpiry !== 0 ? byExpiry : a.id.localeCompare(b.id);
    });
}

export function fefoBatch(
  medicineId: string,
  batches: Batch[],
  now: Date,
): Batch | null {
  return sellableBatches(medicineId, batches, now)[0] ?? null;
}

export function batchesFor(medicineId: string, batches: Batch[]): Batch[] {
  return batches
    .filter((b) => b.medicineId === medicineId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

// ─────────────────────────── pricing ───────────────────────────

export interface LineTotals {
  mrpPaise: number;
  unitPricePaise: number;
  /** Discount for the WHOLE line (per-unit discount × quantity). */
  discountPaise: number;
  /** Line value before discount. */
  grossPaise: number;
  /** GST already contained inside lineTotalPaise — never added on top. */
  taxPaise: number;
  lineTotalPaise: number;
}

/**
 * Indian retail prices are printed tax-inclusive, so tax is EXTRACTED from the
 * line, never appended to it. Adding GST on top of an MRP would overcharge the
 * customer and is illegal.
 */
export function computeLineTotals(
  line: CartLine,
  medicine: Medicine,
  batch: Batch,
): LineTotals {
  const quantity = Math.max(0, Math.trunc(line.quantity));
  const mrpPaise = batch.mrpPaise;
  // Legal ceiling: nothing may ever be billed above the printed MRP.
  const unitPricePaise = Math.min(batch.sellingPaise, mrpPaise);
  const grossPaise = unitPricePaise * quantity;
  const perUnitDiscount = Math.max(0, Math.min(line.discountPaise, unitPricePaise));
  const discountPaise = perUnitDiscount * quantity;
  const lineTotalPaise = Math.max(0, grossPaise - discountPaise);
  const taxPaise = extractInclusiveTax(lineTotalPaise, medicine.gstBps);
  return {
    mrpPaise,
    unitPricePaise,
    discountPaise,
    grossPaise,
    taxPaise,
    lineTotalPaise,
  };
}

export interface CartTotals {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  convenienceFeePaise: number;
  payablePaise: number;
  itemCount: number;
  unitCount: number;
}

export const EMPTY_CART_TOTALS: CartTotals = {
  subtotalPaise: 0,
  discountPaise: 0,
  taxPaise: 0,
  roundOffPaise: 0,
  totalPaise: 0,
  convenienceFeePaise: 0,
  payablePaise: 0,
  itemCount: 0,
  unitCount: 0,
};

export function computeCartTotals(
  cart: CartLine[],
  medicines: Medicine[],
  batches: Batch[],
  feeConfig: FeeConfig,
): CartTotals {
  const medicineById = new Map(medicines.map((m) => [m.id, m]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxPaise = 0;
  let itemCount = 0;
  let unitCount = 0;

  for (const line of cart) {
    const medicine = medicineById.get(line.medicineId);
    const batch = batchById.get(line.batchId);
    // A line whose SKU or lot was deleted underneath it contributes nothing
    // rather than throwing — the cart stays rendered and the line stays visible.
    if (!medicine || !batch) continue;
    const totals = computeLineTotals(line, medicine, batch);
    subtotalPaise += totals.grossPaise;
    discountPaise += totals.discountPaise;
    taxPaise += totals.taxPaise;
    itemCount += 1;
    unitCount += Math.max(0, Math.trunc(line.quantity));
  }

  const net = Math.max(0, subtotalPaise - discountPaise);
  // Round the shop's own receivable to the rupee first; the gateway gross-up is
  // then computed on a clean number so the QR never asks for ₹487.32.
  const { rounded, delta } = roundOffToRupee(net);
  const fees = computeFees(rounded, feeConfig);

  return {
    subtotalPaise,
    discountPaise,
    taxPaise,
    roundOffPaise: delta,
    totalPaise: rounded,
    convenienceFeePaise: fees.convenienceFeePaise,
    payablePaise: fees.payablePaise,
    itemCount,
    unitCount,
  };
}

/** Margin on a lot, in bps of the selling price. Owner/pharmacist views only. */
export function marginBpsOf(batch: Batch): number {
  if (batch.sellingPaise <= 0) return 0;
  return Math.round(((batch.sellingPaise - batch.costPaise) * 10_000) / batch.sellingPaise);
}

/** Capital sitting in a lot, at cost. */
export function batchValuePaise(batch: Batch): number {
  return batch.costPaise * batch.quantity;
}

/** GST portion of an arbitrary inclusive amount — used by the tax summary. */
export function taxOnInclusive(grossPaise: number, gstBps: number): number {
  return extractInclusiveTax(grossPaise, gstBps);
}

/** CGST/SGST split for an intra-state invoice, which every counter sale here is. */
export function splitCgstSgst(taxPaise: number): { cgstPaise: number; sgstPaise: number } {
  const cgstPaise = applyBps(taxPaise, 5_000);
  return { cgstPaise, sgstPaise: taxPaise - cgstPaise };
}

// ─────────────────────────── search ───────────────────────────

export interface SearchOptions {
  limit?: number;
  /** Skip de-listed SKUs. Defaults to true — the counter should not sell them. */
  activeOnly?: boolean;
}

const RANK_BARCODE_EXACT = 0;
const RANK_NAME_PREFIX = 1;
const RANK_NAME_SUBSTRING = 2;
const RANK_GENERIC = 3;
const RANK_MANUFACTURER = 4;
const RANK_BARCODE_PARTIAL = 5;

/**
 * One box does brand, salt, manufacturer and barcode, because that is how the
 * counter actually works: the scanner and the keyboard feed the same field, and
 * a pharmacist substituting a brand searches by salt.
 */
export function searchMedicines(
  query: string,
  medicines: Medicine[],
  opts: SearchOptions = {},
): Medicine[] {
  const limit = opts.limit ?? 20;
  const activeOnly = opts.activeOnly ?? true;
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ medicine: Medicine; rank: number }> = [];

  for (const medicine of medicines) {
    if (activeOnly && !medicine.isActive) continue;

    const name = medicine.name.toLowerCase();
    const generic = medicine.genericName.toLowerCase();
    const manufacturer = medicine.manufacturer.toLowerCase();

    let rank = -1;
    if (medicine.barcodes.some((code) => code === q)) {
      rank = RANK_BARCODE_EXACT;
    } else if (name.startsWith(q)) {
      rank = RANK_NAME_PREFIX;
    } else if (name.includes(q)) {
      rank = RANK_NAME_SUBSTRING;
    } else if (generic.includes(q)) {
      rank = RANK_GENERIC;
    } else if (manufacturer.includes(q)) {
      rank = RANK_MANUFACTURER;
    } else if (q.length >= 4 && medicine.barcodes.some((code) => code.includes(q))) {
      rank = RANK_BARCODE_PARTIAL;
    }

    if (rank >= 0) scored.push({ medicine, rank });
  }

  scored.sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : a.medicine.name.localeCompare(b.medicine.name),
  );

  return scored.slice(0, limit).map((entry) => entry.medicine);
}

export function lookupByBarcode(code: string, medicines: Medicine[]): Medicine | null {
  const needle = code.trim();
  if (!needle) return null;
  return medicines.find((m) => m.barcodes.includes(needle)) ?? null;
}

// ─────────────────────────── labels ───────────────────────────

const SCHEDULE_LABELS: Record<DrugSchedule, string> = {
  OTC: "OTC",
  SCHEDULE_H: "Schedule H",
  SCHEDULE_H1: "Schedule H1",
  SCHEDULE_X: "Schedule X",
  SCHEDULE_G: "Schedule G",
  AYURVEDIC: "Ayurvedic",
};

/** Design-token names, never hex — chips have to survive a theme flip. */
const SCHEDULE_TONES: Record<DrugSchedule, string> = {
  OTC: "neutral",
  SCHEDULE_H: "warning",
  SCHEDULE_H1: "danger",
  SCHEDULE_X: "danger",
  SCHEDULE_G: "accent",
  AYURVEDIC: "success",
};

export function scheduleLabel(schedule: DrugSchedule): string {
  return SCHEDULE_LABELS[schedule];
}

export function scheduleTone(schedule: DrugSchedule): string {
  return SCHEDULE_TONES[schedule];
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  SALE_REVERSAL: "Sale reversal",
  ADJUSTMENT: "Adjustment",
  EXPIRY_WRITE_OFF: "Expiry write-off",
  DAMAGE: "Damage",
  RETURN_TO_SUPPLIER: "Return to supplier",
};

export function movementLabel(type: MovementType): string {
  return MOVEMENT_LABELS[type];
}

const STOCK_TONES: Record<StockState, string> = {
  OUT: "danger",
  CRITICAL: "danger",
  LOW: "warning",
  OK: "success",
};

const EXPIRY_TONES: Record<ExpiryState, string> = {
  EXPIRED: "danger",
  CRITICAL: "danger",
  WARNING: "warning",
  OK: "success",
};

export function stockStateTone(state: StockState): string {
  return STOCK_TONES[state];
}

export function expiryStateTone(state: ExpiryState): string {
  return EXPIRY_TONES[state];
}

export function stockStateLabel(state: StockState): string {
  return state === "OUT"
    ? "Out of stock"
    : state === "CRITICAL"
      ? "Critical"
      : state === "LOW"
        ? "Low"
        : "In stock";
}

export function expiryStateLabel(state: ExpiryState): string {
  return state === "EXPIRED"
    ? "Expired"
    : state === "CRITICAL"
      ? "Expiring soon"
      : state === "WARNING"
        ? "Expiring"
        : "Good";
}
