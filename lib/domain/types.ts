/**
 * Domain model for the pharmacy demo.
 *
 * CONVENTIONS — these are load-bearing, do not deviate:
 *  • All money is an INTEGER count of PAISE. Never a float, never rupees.
 *    Every money field ends in `Paise`. ₹485.00 === 48500.
 *  • All rates are BASIS POINTS (bps). 1200 === 12.00%. Never a float.
 *  • Stock lives on `Batch`, never on `Medicine`. Two lots of the same
 *    medicine legitimately differ in MRP, cost and expiry date.
 *  • `StockMovement` is an append-only ledger. `Batch.quantity` is a cache
 *    of it and the two must always agree.
 */

export type Role = "OWNER" | "PHARMACIST" | "CASHIER";

/** Every gate in the product resolves to one of these. See lib/domain/capabilities.ts. */
export type CapabilityId =
  | "pos.bill"
  | "bill.cancel"
  | "inventory.view"
  | "inventory.edit"
  | "costs.view"
  | "reports.view"
  | "settings.edit"
  | "staff.manage";

/**
 * A named set of capabilities. The three shipped roles are expressed as locked
 * records of this shape so the editor can treat everything uniformly; anything
 * the owner creates is the same thing with `isBuiltIn: false`.
 */
export interface CustomRole {
  id: string;
  name: string;
  description: string;
  capabilities: CapabilityId[];
  /**
   * Keeps `Staff.role` meaningful when a custom role is assigned, so the coarse
   * role checks throughout the product behave sensibly without every call site
   * having to learn about custom roles.
   */
  baseRole: Role;
  tone: string;
  isBuiltIn: boolean;
}

/** Indian drug schedules. Drives the prescription gate at the counter. */
export type DrugSchedule =
  | "OTC"
  | "SCHEDULE_H" // prescription required, record retained
  | "SCHEDULE_H1" // prescription required + mandatory register entry
  | "SCHEDULE_X" // narcotic; prescription retained 2 years
  | "SCHEDULE_G"
  | "AYURVEDIC";

export type MovementType =
  | "PURCHASE"
  | "SALE"
  | "SALE_REVERSAL"
  | "ADJUSTMENT"
  | "EXPIRY_WRITE_OFF"
  | "DAMAGE"
  | "RETURN_TO_SUPPLIER";

export type BillStatus =
  | "DRAFT" // cart open, nothing reserved
  | "AWAITING_PAYMENT" // QR on screen, waiting for confirmation
  | "PAID" // settled; stock committed
  | "CANCELLED"
  | "REFUNDED";

export type PaymentMethod = "CASH" | "UPI" | "CARD";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

/** Who absorbs the payment-gateway cut. */
export type FeeMode =
  | "ABSORB" // shop eats it; customer pays exactly the bill total
  | "PASS_TO_CUSTOMER" // bill grossed up so the shop nets the full total
  | "SPLIT"; // a configurable share of the gross-up is passed on

export type StockState = "OUT" | "CRITICAL" | "LOW" | "OK";
export type ExpiryState = "EXPIRED" | "CRITICAL" | "WARNING" | "OK";

// ─────────────────────────── people ───────────────────────────

export interface Staff {
  id: string;
  name: string;
  email: string;
  /** 4 digits. Lets a second cashier take the till mid-queue without a full re-login. */
  pin: string;
  role: Role;
  /** Set when a custom role is assigned. Falls back to `role` when absent. */
  roleId?: string;
  isActive: boolean;
  avatarTone: string;
}

// ─────────────────────────── catalogue ───────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Design-token name, never a raw hex — keeps chips theme-aware in light and dark. */
  tone: string;
  sortOrder: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  city?: string;
}

/** The SKU master. Holds no stock — see Batch. */
export interface Medicine {
  id: string;
  /** Brand name as printed on the pack, e.g. "Dolo 650". */
  name: string;
  /** Salt / composition, e.g. "Paracetamol 650mg" — what pharmacists search when substituting. */
  genericName: string;
  manufacturer: string;
  categoryId: string;
  schedule: DrugSchedule;
  requiresPrescription: boolean;
  hsnCode: string;
  /** GST in basis points. 500 = 5%, 1200 = 12%. */
  gstBps: number;
  /** What one sellable unit is called: strip, bottle, tube, vial. */
  unitLabel: string;
  /** Tablets (or ml) per sellable unit. */
  packSize: number;
  /** Below this total on-hand quantity the SKU surfaces in Reorder. */
  reorderLevel: number;
  rackLocation: string;
  /** A SKU can carry several barcodes (pack sizes, relabelled vendor stock). */
  barcodes: string[];
  isActive: boolean;
}

// ─────────────────────────── stock ───────────────────────────

/** A physical lot. Stock and pricing both live here. */
export interface Batch {
  id: string;
  medicineId: string;
  batchNumber: string;
  /** ISO date string. */
  expiryDate: string;
  /** Units on hand. Cache of the StockMovement ledger. */
  quantity: number;
  mrpPaise: number;
  /** Purchase price per unit. OWNER/PHARMACIST only — never rendered in a CASHIER session. */
  costPaise: number;
  /** Counter price per unit. Must be <= mrpPaise (legal ceiling in India). */
  sellingPaise: number;
  supplierId?: string;
  invoiceRef?: string;
  receivedAt: string;
}

/** Append-only. `balanceAfter` makes the ledger self-auditing without replaying history. */
export interface StockMovement {
  id: string;
  batchId: string;
  medicineId: string;
  type: MovementType;
  /** Signed. Positive = stock in, negative = stock out. */
  quantity: number;
  balanceAfter: number;
  reason?: string;
  billId?: string;
  staffId?: string;
  createdAt: string;
}

// ─────────────────────────── billing ───────────────────────────

/** A line in the open cart, before it becomes an immutable BillItem. */
export interface CartLine {
  id: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  /** Per-unit discount in paise, applied before tax. */
  discountPaise: number;
}

/**
 * Line items snapshot name/batch/expiry/price at sale time. Editing a Medicine
 * or Batch later must never rewrite history on an issued invoice.
 */
export interface BillItem {
  id: string;
  medicineId: string;
  batchId: string;
  nameSnapshot: string;
  genericSnapshot: string;
  batchNumberSnapshot: string;
  expirySnapshot: string;
  hsnSnapshot: string;
  unitLabel: string;
  quantity: number;
  mrpPaise: number;
  unitPricePaise: number;
  discountPaise: number;
  gstBps: number;
  /** Tax component contained within lineTotalPaise (Indian MRP is tax-inclusive). */
  taxPaise: number;
  lineTotalPaise: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  status: BillStatus;

  customerName?: string;
  customerPhone?: string;
  doctorName?: string;
  prescriptionRef?: string;

  items: BillItem[];

  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  /** What the shop is owed. The number that lands in the ledger. */
  totalPaise: number;

  /** Gross-up so the shop still nets `totalPaise` after the gateway cut. 0 when ABSORB. */
  convenienceFeePaise: number;
  /** totalPaise + convenienceFeePaise — what the customer actually pays. */
  payablePaise: number;

  method?: PaymentMethod;
  cashierId: string;

  /**
   * Idempotency guard. Stock is decremented exactly once, in the same commit
   * that flips this true. A replayed payment event cannot double-decrement.
   */
  stockCommitted: boolean;

  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
}

// ─────────────────────────── payments ───────────────────────────

export interface Payment {
  id: string;
  billId: string;
  /** "mock" | "razorpay" */
  provider: string;
  status: PaymentStatus;

  /** What the customer is charged (bill.payablePaise). */
  amountPaise: number;
  /** What the gateway deducted, read back from the settlement event. */
  gatewayFeePaise: number;
  /** amountPaise - gatewayFeePaise. Reconciled against bill.totalPaise. */
  netPaise: number;

  providerQrId?: string;
  providerPaymentId?: string;

  /** The real `upi://pay?pa=…&am=…` string encoded into the QR. */
  upiUri?: string;
  payerVpa?: string;

  expiresAt?: string;
  createdAt: string;
  paidAt?: string;
}

/**
 * Every inbound gateway event is recorded before any stock is touched, keyed
 * uniquely, so replays are detected first. The demo renders these verbatim in
 * the payment inspector so the mechanics are visible, not hand-waved.
 */
export interface WebhookEvent {
  id: string;
  provider: string;
  /** Provider's own event id. The idempotency key. */
  eventId: string;
  eventType: string;
  status: "RECEIVED" | "PROCESSED" | "IGNORED" | "FAILED";
  /** HMAC-SHA256 of the payload, exactly as a gateway would sign it. */
  signature: string;
  payload: unknown;
  note?: string;
  receivedAt: string;
  processedAt?: string;
}

// ─────────────────────────── settings ───────────────────────────

export interface ShopSettings {
  shopName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  drugLicenseNo: string;
  upiVpa: string;
  upiPayeeName: string;
  invoicePrefix: string;
  invoiceCounter: number;
  /** Days before expiry a batch starts showing the amber "expiring" state. */
  expiryWarningDays: number;
}

/** Gateway fee policy. OWNER-editable only. */
export interface FeeConfig {
  mode: FeeMode;
  /** Gateway percentage in bps. Razorpay standard is 200 (2%). */
  percentBps: number;
  /** Flat per-transaction component, if the plan has one. */
  fixedPaise: number;
  /** GST charged on the gateway fee itself. India: 1800 (18%). */
  gstOnFeeBps: number;
  /** For SPLIT: how much of the gross-up the customer carries, 0–100. */
  passSharePercent: number;
  /** Round the customer-facing gross-up up to this granularity.
   *  100 = whole rupees, so a QR never asks for ₹487.32. */
  roundToPaise: number;
  showOnBill: boolean;
  label: string;
}
