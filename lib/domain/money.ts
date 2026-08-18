/**
 * Money and rate arithmetic. Every value here is an integer.
 *
 * Rupee floats are banned: 0.1 + 0.2 !== 0.3, and a pharmacy that loses a paise
 * per line item loses real money by close of day. Paise in, paise out, round once
 * at the boundary and always in a stated direction.
 */

import type { FeeConfig } from "./types";

/** ₹ formatting. `48500` → "₹485.00" */
export function formatPaise(paise: number, opts?: { compact?: boolean }): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  // Thresholds and divisors are both in PAISE. One lakh rupees is 10,000,000
  // paise and one crore is 1,000,000,000 paise; comparing paise against rupee
  // thresholds is what made this read 100x high.
  if (opts?.compact && abs >= 1_000_000_000) return `${sign}₹${(abs / 1_000_000_000).toFixed(2)}Cr`;
  if (opts?.compact && abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}L`;
  const rupees = Math.floor(abs / 100);
  const paisePart = abs % 100;
  // Indian digit grouping: 12,34,567 not 1,234,567
  const grouped = rupees.toLocaleString("en-IN");
  return `${sign}₹${grouped}.${String(paisePart).padStart(2, "0")}`;
}

/** Same as formatPaise but drops `.00` on whole rupees — for dense tables. */
export function formatPaiseTight(paise: number): string {
  return paise % 100 === 0
    ? `₹${Math.floor(paise / 100).toLocaleString("en-IN")}`
    : formatPaise(paise);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Basis points → display string. `1200` → "12%", `250` → "2.5%" */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
}

/** Apply a bps rate to a paise amount. Rounds half-up to the nearest paise. */
export function applyBps(paise: number, bps: number): number {
  return Math.round((paise * bps) / 10_000);
}

/** Round UP to a granularity. `roundUpTo(48732, 100)` → 48800 (whole rupee). */
export function roundUpTo(paise: number, granularity: number): number {
  if (granularity <= 1) return Math.ceil(paise);
  return Math.ceil(paise / granularity) * granularity;
}

/**
 * Indian retail MRP is tax-INCLUSIVE. Given a gross line total and a GST rate,
 * extract the tax already contained inside it.
 *
 *   gross = net × (1 + rate)  ⇒  tax = gross × rate / (1 + rate)
 *
 * A ₹100 line at 12% GST contains ₹10.71 of tax, not ₹12.
 */
export function extractInclusiveTax(grossPaise: number, gstBps: number): number {
  return Math.round((grossPaise * gstBps) / (10_000 + gstBps));
}

/** Round-off to the nearest rupee, as printed on Indian invoices. */
export function roundOffToRupee(paise: number): { rounded: number; delta: number } {
  const rounded = Math.round(paise / 100) * 100;
  return { rounded, delta: rounded - paise };
}

// ─────────────────────── gateway fee gross-up ───────────────────────

export interface FeeBreakdown {
  /** What the shop is owed, before any gateway consideration. */
  totalPaise: number;
  /** Added to the customer's bill. 0 under ABSORB. */
  convenienceFeePaise: number;
  /** What the customer pays / the QR asks for. */
  payablePaise: number;
  /** What the gateway will deduct from `payablePaise`. */
  gatewayFeePaise: number;
  /** What actually lands in the shop's account. */
  netToShopPaise: number;
  /** netToShop − total. ≥ 0 means the shop is whole. */
  shortfallPaise: number;
  /** Effective all-in gateway rate in bps, incl. GST on the fee. */
  effectiveRateBps: number;
}

/**
 * Compute the gateway fee and, when configured, the gross-up that keeps the
 * shop whole.
 *
 * The gateway charges its cut on the amount it CAPTURES, not on the amount the
 * shop wants to receive. So you cannot simply add 2% — that undercharges,
 * because the 2% is then itself taxed by the gateway.
 *
 * Let  T = bill total,  R = effective rate (incl. GST on the fee).
 * We need a charge C such that the shop nets T:
 *
 *     C − C·R = T   ⇒   C = T / (1 − R)
 *
 * Adding a naive 2% to ₹485 gives ₹494.70, of which the gateway takes ₹11.67,
 * leaving ₹483.03 — the shop is ₹1.97 short. Solving properly gives ₹495.
 */
export function computeFees(totalPaise: number, config: FeeConfig): FeeBreakdown {
  // Percentage cut plus GST levied on that cut.
  const effectiveRateBps = Math.round(
    config.percentBps * (1 + config.gstOnFeeBps / 10_000),
  );
  const rate = effectiveRateBps / 10_000;

  // Guard: a rate at or above 100% has no solution.
  const safeRate = rate >= 0.5 ? 0.5 : rate;

  const grossedUp =
    safeRate <= 0 && config.fixedPaise === 0
      ? totalPaise
      : (totalPaise + config.fixedPaise) / (1 - safeRate);

  const fullGrossUp = Math.max(0, Math.ceil(grossedUp) - totalPaise);

  let convenienceFeePaise = 0;
  if (config.mode === "PASS_TO_CUSTOMER") {
    convenienceFeePaise = roundUpTo(fullGrossUp, config.roundToPaise);
  } else if (config.mode === "SPLIT") {
    const share = Math.max(0, Math.min(100, config.passSharePercent));
    convenienceFeePaise = roundUpTo(
      Math.round((fullGrossUp * share) / 100),
      config.roundToPaise,
    );
  }
  // ABSORB leaves convenienceFeePaise at 0.

  const payablePaise = totalPaise + convenienceFeePaise;
  const gatewayFeePaise = applyBps(payablePaise, effectiveRateBps) + config.fixedPaise;
  const netToShopPaise = payablePaise - gatewayFeePaise;

  return {
    totalPaise,
    convenienceFeePaise,
    payablePaise,
    gatewayFeePaise,
    netToShopPaise,
    shortfallPaise: netToShopPaise - totalPaise,
    effectiveRateBps,
  };
}

// ─────────────────────── UPI intent ───────────────────────

/**
 * Build a real, scannable UPI intent URI per NPCI's deep-link spec. Any UPI app
 * (GPay, PhonePe, Paytm, BHIM) resolves this. Nothing here is simulated —
 * only the settlement confirmation is.
 *
 * `am` must be rupees with 2 decimals; `tr` is the merchant reference the
 * settlement event echoes back for reconciliation.
 */
export function buildUpiUri(input: {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  transactionRef: string;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: input.payeeName,
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
    tr: input.transactionRef,
    tn: input.note ?? `Bill ${input.transactionRef}`,
  });
  return `upi://pay?${params.toString()}`;
}
