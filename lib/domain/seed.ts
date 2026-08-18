/**
 * Demo dataset for Meridian Pharmacy.
 *
 * DETERMINISM IS A HARD REQUIREMENT. This module is imported by a "use client"
 * store, which Next.js still evaluates on the server during SSR. If the seed
 * used `Math.random()` or a raw `Date.now()`, the server-rendered markup and the
 * first client render would disagree and React would blow up with a hydration
 * mismatch. So:
 *
 *   • all randomness comes from mulberry32 with a fixed constant;
 *   • every date is derived from the single `now` handed to `buildSeed`, and
 *     `seedNow()` quantises that to UTC midnight so two machines rendering the
 *     same calendar day produce byte-identical data;
 *   • every id is a stable slug (`med_dolo650`, `bat_dolo650_a`), never random.
 *
 * The stock and expiry distribution is engineered, not sampled: the counts of
 * expired / expiring / out-of-stock / low lots are fixed so that every UI state
 * in the app is populated on a first, un-clicked load.
 */

import { computeFees, extractInclusiveTax, roundOffToRupee } from "./money";
import type {
  Batch,
  Bill,
  BillItem,
  Category,
  DrugSchedule,
  FeeConfig,
  Medicine,
  Payment,
  ShopSettings,
  Staff,
  StockMovement,
  Supplier,
  WebhookEvent,
} from "./types";

// ─────────────────────────── deterministic primitives ───────────────────────────

/** mulberry32 — small, fast, and identical on every engine. Fixed seed, always. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const SEED_CONSTANT = 0x5f37_1d9b;

type Rng = () => number;

function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

const DAY_MS = 86_400_000;

/** UTC midnight of the given instant. See the determinism note at the top. */
export function seedNow(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
}

function shiftDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** `YYYY-MM-DD`. Expiry is a calendar fact, so it carries no time component. */
function isoDay(base: Date, days: number): string {
  return shiftDays(base, days).toISOString().slice(0, 10);
}

function isoAt(base: Date, days: number, hour: number, minute: number): string {
  return new Date(
    base.getTime() + days * DAY_MS + hour * 3_600_000 + minute * 60_000,
  ).toISOString();
}

/**
 * HMAC-SHA256-shaped signature: 64 lowercase hex characters, deterministic for a
 * given payload. Deliberately NOT node:crypto — the store runs in the browser and
 * a Node import would break the bundle. The point of the demo is that a signature
 * exists, is stored verbatim, and is stable across a replay of the same payload.
 */
export function signPayload(payload: string, secret = "whsec_meridian_demo"): string {
  const input = `${secret}.${payload}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let state = h === 0 ? 0x9e3779b9 : h;
  let out = "";
  while (out.length < 64) {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    out += state.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

/** Real EAN-13 check digit, so a scanner-shaped string actually validates. */
function ean13(body12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = body12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return body12 + String((10 - (sum % 10)) % 10);
}

/** "890" is India's GS1 prefix. The stride keeps every generated code unique. */
function barcodeAt(index: number): string {
  return ean13(`890${String(1_100_000 + index * 9_137).padStart(9, "0")}`);
}

// ─────────────────────────── categories ───────────────────────────

interface CategorySpec {
  key: string;
  name: string;
  tone: string;
  rackLetter: string;
}

const CATEGORY_SPECS: readonly CategorySpec[] = [
  { key: "analgesics", name: "Analgesics", tone: "danger", rackLetter: "A" },
  { key: "antibiotics", name: "Antibiotics", tone: "brand", rackLetter: "B" },
  { key: "cardiac", name: "Cardiac", tone: "accent", rackLetter: "C" },
  { key: "diabetes", name: "Diabetes care", tone: "warning", rackLetter: "D" },
  { key: "gastro", name: "Gastro", tone: "success", rackLetter: "E" },
  { key: "respiratory", name: "Respiratory", tone: "brand", rackLetter: "F" },
  { key: "dermatology", name: "Dermatology", tone: "accent", rackLetter: "G" },
  { key: "vitamins", name: "Vitamins & supplements", tone: "success", rackLetter: "H" },
  { key: "babycare", name: "Baby care", tone: "neutral", rackLetter: "J" },
  { key: "firstaid", name: "First aid", tone: "warning", rackLetter: "K" },
  { key: "ayurvedic", name: "Ayurvedic", tone: "success", rackLetter: "L" },
  { key: "surgical", name: "Surgical & devices", tone: "neutral", rackLetter: "M" },
];

function buildCategories(): Category[] {
  return CATEGORY_SPECS.map((spec, index) => ({
    id: `cat_${spec.key}`,
    name: spec.name,
    slug: spec.key,
    tone: spec.tone,
    sortOrder: index + 1,
  }));
}

// ─────────────────────────── suppliers ───────────────────────────

const SUPPLIERS: readonly Supplier[] = [
  {
    id: "sup_aditya",
    name: "Aditya Pharma Distributors",
    phone: "+91 80 2556 4412",
    gstin: "29AACCA1234F1Z5",
    city: "Bengaluru",
  },
  {
    id: "sup_sanjeevani",
    name: "Sanjeevani Medical Agencies",
    phone: "+91 821 244 7719",
    gstin: "29AABCS4521M1ZP",
    city: "Mysuru",
  },
  {
    id: "sup_vardhman",
    name: "Vardhman Healthcare Supplies",
    phone: "+91 836 227 3390",
    gstin: "29AAECV7788Q1ZK",
    city: "Hubballi",
  },
  {
    id: "sup_krishna",
    name: "Krishna Drug House",
    phone: "+91 80 4128 9065",
    gstin: "29AAFCK3312J1ZR",
    city: "Bengaluru",
  },
  {
    id: "sup_medilink",
    name: "Medilink Distributors Pvt Ltd",
    phone: "+91 44 2834 5561",
    gstin: "33AAGCM9014L1ZB",
    city: "Chennai",
  },
  {
    id: "sup_navjeevan",
    name: "Navjeevan Pharma Traders",
    phone: "+91 40 2761 8823",
    gstin: "36AAHCN5567T1ZW",
    city: "Hyderabad",
  },
];

const SUPPLIER_INVOICE_PREFIX: Readonly<Record<string, string>> = {
  sup_aditya: "APD",
  sup_sanjeevani: "SMA",
  sup_vardhman: "VHS",
  sup_krishna: "KDH",
  sup_medilink: "MDL",
  sup_navjeevan: "NPT",
};

// ─────────────────────────── staff ───────────────────────────

const STAFF: readonly Staff[] = [
  {
    id: "stf_ravi",
    name: "Ravi Menon",
    email: "ravi.menon@meridianpharmacy.in",
    pin: "4417",
    role: "OWNER",
    isActive: true,
    avatarTone: "brand",
  },
  {
    id: "stf_ananya",
    name: "Ananya Iyer",
    email: "ananya.iyer@meridianpharmacy.in",
    pin: "2938",
    role: "PHARMACIST",
    isActive: true,
    avatarTone: "accent",
  },
  {
    id: "stf_kiran",
    name: "Kiran Deshpande",
    email: "kiran.deshpande@meridianpharmacy.in",
    pin: "1075",
    role: "CASHIER",
    isActive: true,
    avatarTone: "success",
  },
  {
    id: "stf_farhan",
    name: "Farhan Qureshi",
    email: "farhan.qureshi@meridianpharmacy.in",
    pin: "6602",
    role: "CASHIER",
    isActive: true,
    avatarTone: "warning",
  },
];

// ─────────────────────────── catalogue ───────────────────────────

interface CatalogSpec {
  key: string;
  name: string;
  generic: string;
  manufacturer: string;
  category: string;
  schedule: DrugSchedule;
  gstBps: number;
  unit: string;
  packSize: number;
  /** Printed MRP for the current lot, in paise. */
  mrpPaise: number;
  hsn: string;
}

const CATALOG: readonly CatalogSpec[] = [
  // ── Analgesics ──
  { key: "dolo650", name: "Dolo 650", generic: "Paracetamol 650mg", manufacturer: "Micro Labs", category: "analgesics", schedule: "OTC", gstBps: 500, unit: "strip", packSize: 15, mrpPaise: 3400, hsn: "3004" },
  { key: "crocin", name: "Crocin Advance 500", generic: "Paracetamol 500mg", manufacturer: "GSK Consumer Healthcare", category: "analgesics", schedule: "OTC", gstBps: 500, unit: "strip", packSize: 15, mrpPaise: 3000, hsn: "3004" },
  { key: "combiflam", name: "Combiflam", generic: "Ibuprofen 400mg + Paracetamol 325mg", manufacturer: "Sanofi India", category: "analgesics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 20, mrpPaise: 4400, hsn: "3004" },
  { key: "zerodolsp", name: "Zerodol SP", generic: "Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg", manufacturer: "Ipca Laboratories", category: "analgesics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 12800, hsn: "3004" },
  { key: "meftalspas", name: "Meftal Spas", generic: "Mefenamic Acid 250mg + Dicyclomine 10mg", manufacturer: "Blue Cross Laboratories", category: "analgesics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 7500, hsn: "3004" },
  { key: "volini", name: "Volini Gel 30g", generic: "Diclofenac Diethylamine 1.16% w/w", manufacturer: "Sun Pharmaceutical", category: "analgesics", schedule: "OTC", gstBps: 1200, unit: "tube", packSize: 1, mrpPaise: 15500, hsn: "3004" },
  { key: "moov", name: "Moov Pain Relief Cream 30g", generic: "Diclofenac Diethylamine + Mint Oil + Nilgiri Oil", manufacturer: "Reckitt Benckiser India", category: "analgesics", schedule: "OTC", gstBps: 1200, unit: "tube", packSize: 1, mrpPaise: 13500, hsn: "3004" },
  { key: "codistar", name: "Codistar Cough Syrup 100ml", generic: "Codeine Phosphate 10mg + Chlorpheniramine 4mg / 5ml", manufacturer: "Zydus Healthcare", category: "analgesics", schedule: "SCHEDULE_X", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 14200, hsn: "3004" },
  { key: "corexdx", name: "Corex DX Syrup 100ml", generic: "Codeine Phosphate 10mg + Triprolidine 1.25mg / 5ml", manufacturer: "Pfizer Ltd", category: "analgesics", schedule: "SCHEDULE_X", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 15800, hsn: "3004" },

  // ── Antibiotics ──
  { key: "augmentin625", name: "Augmentin 625 Duo", generic: "Amoxicillin 500mg + Clavulanic Acid 125mg", manufacturer: "GlaxoSmithKline Pharmaceuticals", category: "antibiotics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 22400, hsn: "3004" },
  { key: "azithral500", name: "Azithral 500", generic: "Azithromycin 500mg", manufacturer: "Alembic Pharmaceuticals", category: "antibiotics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 5, mrpPaise: 12300, hsn: "3004" },
  { key: "ciplox500", name: "Ciplox 500", generic: "Ciprofloxacin 500mg", manufacturer: "Cipla Ltd", category: "antibiotics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 8900, hsn: "3004" },
  { key: "levoflox500", name: "Levoflox 500", generic: "Levofloxacin 500mg", manufacturer: "Cipla Ltd", category: "antibiotics", schedule: "SCHEDULE_H1", gstBps: 1200, unit: "strip", packSize: 5, mrpPaise: 13500, hsn: "3004" },
  { key: "moxikindcv625", name: "Moxikind-CV 625", generic: "Amoxicillin 500mg + Clavulanic Acid 125mg", manufacturer: "Mankind Pharma", category: "antibiotics", schedule: "SCHEDULE_H1", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 19800, hsn: "3004" },
  { key: "metrogyl400", name: "Metrogyl 400", generic: "Metronidazole 400mg", manufacturer: "J.B. Chemicals & Pharmaceuticals", category: "antibiotics", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 4200, hsn: "3004" },

  // ── Cardiac ──
  { key: "telma40", name: "Telma 40", generic: "Telmisartan 40mg", manufacturer: "Glenmark Pharmaceuticals", category: "cardiac", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 14500, hsn: "3004" },
  { key: "ecosprin75", name: "Ecosprin 75", generic: "Aspirin 75mg", manufacturer: "USV Private Ltd", category: "cardiac", schedule: "SCHEDULE_H", gstBps: 500, unit: "strip", packSize: 14, mrpPaise: 1400, hsn: "3004" },
  { key: "amlokindat", name: "Amlokind-AT", generic: "Amlodipine 5mg + Atenolol 50mg", manufacturer: "Mankind Pharma", category: "cardiac", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 5600, hsn: "3004" },
  { key: "rosuvas10", name: "Rosuvas 10", generic: "Rosuvastatin 10mg", manufacturer: "Sun Pharmaceutical", category: "cardiac", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 17200, hsn: "3004" },
  { key: "clopitab75", name: "Clopitab 75", generic: "Clopidogrel 75mg", manufacturer: "Ipca Laboratories", category: "cardiac", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 9400, hsn: "3004" },

  // ── Diabetes care ──
  { key: "glycomet500", name: "Glycomet 500", generic: "Metformin Hydrochloride 500mg", manufacturer: "USV Private Ltd", category: "diabetes", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 20, mrpPaise: 3200, hsn: "3004" },
  { key: "glycometgp2", name: "Glycomet GP 2", generic: "Glimepiride 2mg + Metformin 500mg", manufacturer: "USV Private Ltd", category: "diabetes", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 12800, hsn: "3004" },
  { key: "lantussolostar", name: "Lantus SoloStar Pen 3ml", generic: "Insulin Glargine 100IU/ml", manufacturer: "Sanofi India", category: "diabetes", schedule: "SCHEDULE_H", gstBps: 500, unit: "pack", packSize: 1, mrpPaise: 85400, hsn: "3004" },
  { key: "accuchekstrips", name: "Accu-Chek Active Test Strips (50)", generic: "Blood Glucose Test Strips", manufacturer: "Roche Diagnostics India", category: "diabetes", schedule: "OTC", gstBps: 1200, unit: "box", packSize: 50, mrpPaise: 112500, hsn: "3822" },
  { key: "accuchekmeter", name: "Accu-Chek Active Glucometer Kit", generic: "Blood Glucose Monitoring System", manufacturer: "Roche Diagnostics India", category: "diabetes", schedule: "OTC", gstBps: 1800, unit: "box", packSize: 1, mrpPaise: 145000, hsn: "9027" },
  { key: "thyronorm50", name: "Thyronorm 50mcg", generic: "Thyroxine Sodium 50mcg", manufacturer: "Abbott India", category: "diabetes", schedule: "SCHEDULE_H", gstBps: 500, unit: "bottle", packSize: 120, mrpPaise: 16800, hsn: "3004" },

  // ── Gastro ──
  { key: "pand", name: "Pan-D", generic: "Pantoprazole 40mg + Domperidone 30mg", manufacturer: "Alkem Laboratories", category: "gastro", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 19800, hsn: "3004" },
  { key: "omez20", name: "Omez 20", generic: "Omeprazole 20mg", manufacturer: "Dr. Reddy's Laboratories", category: "gastro", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 20, mrpPaise: 9600, hsn: "3004" },
  { key: "rantac150", name: "Rantac 150", generic: "Ranitidine 150mg", manufacturer: "J.B. Chemicals & Pharmaceuticals", category: "gastro", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 2800, hsn: "3004" },
  { key: "digene", name: "Digene Antacid Gel Mint 200ml", generic: "Magnesium Hydroxide + Aluminium Hydroxide + Simethicone", manufacturer: "Abbott India", category: "gastro", schedule: "OTC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 15300, hsn: "3004" },
  { key: "duphalac", name: "Duphalac 450ml", generic: "Lactulose Solution 10g/15ml", manufacturer: "Abbott India", category: "gastro", schedule: "SCHEDULE_H", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 39500, hsn: "3004" },
  { key: "dulcoflex", name: "Dulcoflex 5mg", generic: "Bisacodyl 5mg", manufacturer: "Sanofi India", category: "gastro", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 3800, hsn: "3004" },

  // ── Respiratory ──
  { key: "monteklc", name: "Montek LC", generic: "Montelukast 10mg + Levocetirizine 5mg", manufacturer: "Sun Pharmaceutical", category: "respiratory", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 18400, hsn: "3004" },
  { key: "allegra120", name: "Allegra 120", generic: "Fexofenadine Hydrochloride 120mg", manufacturer: "Sanofi India", category: "respiratory", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 20500, hsn: "3004" },
  { key: "cetzine10", name: "Cetzine 10", generic: "Cetirizine Hydrochloride 10mg", manufacturer: "GlaxoSmithKline Pharmaceuticals", category: "respiratory", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 2900, hsn: "3004" },
  { key: "chestoncold", name: "Cheston Cold", generic: "Cetirizine 5mg + Paracetamol 325mg + Phenylephrine 10mg", manufacturer: "Cipla Ltd", category: "respiratory", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 6200, hsn: "3004" },
  { key: "sinarest", name: "Sinarest", generic: "Paracetamol 500mg + Phenylephrine 10mg + Chlorpheniramine 2mg", manufacturer: "Centaur Pharmaceuticals", category: "respiratory", schedule: "SCHEDULE_H", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 8400, hsn: "3004" },
  { key: "otrivin", name: "Otrivin Nasal Spray 10ml", generic: "Xylometazoline Hydrochloride 0.1%", manufacturer: "GlaxoSmithKline Consumer", category: "respiratory", schedule: "OTC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 10800, hsn: "3004" },
  { key: "nasivion", name: "Nasivion Nasal Drops 10ml", generic: "Oxymetazoline Hydrochloride 0.05%", manufacturer: "Merck Ltd", category: "respiratory", schedule: "OTC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 9400, hsn: "3004" },

  // ── Dermatology ──
  { key: "betadine", name: "Betadine Ointment 20g", generic: "Povidone Iodine 5% w/w", manufacturer: "Win-Medicare", category: "dermatology", schedule: "OTC", gstBps: 1200, unit: "tube", packSize: 1, mrpPaise: 11600, hsn: "3004" },
  { key: "soframycin", name: "Soframycin Skin Cream 30g", generic: "Framycetin Sulphate 1% w/w", manufacturer: "Sanofi India", category: "dermatology", schedule: "SCHEDULE_H", gstBps: 1200, unit: "tube", packSize: 1, mrpPaise: 5500, hsn: "3004" },
  { key: "candid", name: "Candid Dusting Powder 100g", generic: "Clotrimazole 1% w/w", manufacturer: "Glenmark Pharmaceuticals", category: "dermatology", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 14900, hsn: "3004" },

  // ── Vitamins & supplements ──
  { key: "shelcal500", name: "Shelcal 500", generic: "Calcium Carbonate 500mg + Vitamin D3 250IU", manufacturer: "Torrent Pharmaceuticals", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 12200, hsn: "3004" },
  { key: "zincovit", name: "Zincovit Tablets", generic: "Multivitamin + Multimineral + Zinc", manufacturer: "Apex Laboratories", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 10800, hsn: "3004" },
  { key: "neurobionforte", name: "Neurobion Forte", generic: "Vitamin B-Complex with Vitamin B12", manufacturer: "Procter & Gamble Health", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 30, mrpPaise: 3600, hsn: "3004" },
  { key: "evion400", name: "Evion 400", generic: "Vitamin E 400mg", manufacturer: "Merck Ltd", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 10, mrpPaise: 4900, hsn: "3004" },
  { key: "limcee", name: "Limcee 500", generic: "Vitamin C 500mg Chewable", manufacturer: "Abbott India", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 2400, hsn: "3004" },
  { key: "supradyn", name: "Supradyn Daily", generic: "Multivitamin + Multimineral", manufacturer: "Bayer Pharmaceuticals", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "strip", packSize: 15, mrpPaise: 4200, hsn: "3004" },
  { key: "revitalh", name: "Revital H Capsules (30)", generic: "Ginseng + Multivitamin + Multimineral", manufacturer: "Sun Pharmaceutical", category: "vitamins", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 30, mrpPaise: 46500, hsn: "3004" },

  // ── Baby care ──
  { key: "cerelacwheat", name: "Cerelac Wheat Stage 1 300g", generic: "Infant Cereal with Milk", manufacturer: "Nestlé India", category: "babycare", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 29500, hsn: "1901" },
  { key: "himalayababysoap", name: "Himalaya Baby Soap 125g", generic: "Olive Oil & Almond Oil Baby Soap", manufacturer: "Himalaya Wellness", category: "babycare", schedule: "AYURVEDIC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 8500, hsn: "3401" },
  { key: "colicaid", name: "Colicaid Drops 15ml", generic: "Simethicone + Dill Oil + Fennel Oil", manufacturer: "Zydus Healthcare", category: "babycare", schedule: "OTC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 12800, hsn: "3004" },

  // ── First aid ──
  { key: "dettol", name: "Dettol Antiseptic Liquid 250ml", generic: "Chloroxylenol 4.8% v/v", manufacturer: "Reckitt Benckiser India", category: "firstaid", schedule: "OTC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 15500, hsn: "3808" },
  { key: "hansaplast", name: "Hansaplast Washproof Strips (100)", generic: "Adhesive Wound Dressing Strips", manufacturer: "Beiersdorf India", category: "firstaid", schedule: "OTC", gstBps: 1200, unit: "box", packSize: 100, mrpPaise: 21500, hsn: "3005" },
  { key: "burnol", name: "Burnol Cream 20g", generic: "Aminacrine Hydrochloride + Cetrimide", manufacturer: "Dr. Morepen Ltd", category: "firstaid", schedule: "OTC", gstBps: 1200, unit: "tube", packSize: 1, mrpPaise: 6500, hsn: "3004" },
  { key: "electralors", name: "Electral ORS Powder 21.8g", generic: "Oral Rehydration Salts IP", manufacturer: "FDC Ltd", category: "firstaid", schedule: "OTC", gstBps: 500, unit: "pack", packSize: 1, mrpPaise: 2200, hsn: "3004" },

  // ── Ayurvedic ──
  { key: "liv52ds", name: "Liv.52 DS Tablets (60)", generic: "Himsra + Kasani + Kakamachi Herbal Blend", manufacturer: "Himalaya Wellness", category: "ayurvedic", schedule: "AYURVEDIC", gstBps: 500, unit: "bottle", packSize: 60, mrpPaise: 19500, hsn: "3004" },
  { key: "septilin", name: "Septilin Tablets (60)", generic: "Guggulu + Guduchi + Manjishtha", manufacturer: "Himalaya Wellness", category: "ayurvedic", schedule: "AYURVEDIC", gstBps: 500, unit: "bottle", packSize: 60, mrpPaise: 21000, hsn: "3004" },
  { key: "cystone", name: "Cystone Tablets (60)", generic: "Shilapushpa + Pashanabheda + Gokshura", manufacturer: "Himalaya Wellness", category: "ayurvedic", schedule: "AYURVEDIC", gstBps: 500, unit: "bottle", packSize: 60, mrpPaise: 22800, hsn: "3004" },
  { key: "chyawanprash", name: "Dabur Chyawanprash 1kg", generic: "Amla-based Ayurvedic Rasayana", manufacturer: "Dabur India", category: "ayurvedic", schedule: "AYURVEDIC", gstBps: 500, unit: "pack", packSize: 1, mrpPaise: 51000, hsn: "3004" },
  { key: "zandubalm", name: "Zandu Balm 25ml", generic: "Gaultheria Oil + Menthol + Eucalyptus Oil", manufacturer: "Emami Ltd", category: "ayurvedic", schedule: "AYURVEDIC", gstBps: 1200, unit: "bottle", packSize: 1, mrpPaise: 12500, hsn: "3004" },

  // ── Surgical & devices ──
  { key: "cotton500", name: "Absorbent Cotton Wool 500g", generic: "Sterile Absorbent Cotton IP", manufacturer: "Bengal Surgical Industries", category: "surgical", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 26500, hsn: "3005" },
  { key: "crepebandage", name: "Crepe Bandage 10cm x 4m", generic: "Elastic Crepe Bandage", manufacturer: "Datt Mediproducts", category: "surgical", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 14500, hsn: "3005" },
  { key: "thermometer", name: "Dr. Morepen Digital Thermometer MT-111", generic: "Digital Clinical Thermometer", manufacturer: "Dr. Morepen Ltd", category: "surgical", schedule: "OTC", gstBps: 1800, unit: "box", packSize: 1, mrpPaise: 21000, hsn: "9025" },
  { key: "bpmonitor", name: "Omron HEM-7124 BP Monitor", generic: "Digital Automatic Blood Pressure Monitor", manufacturer: "Omron Healthcare India", category: "surgical", schedule: "OTC", gstBps: 1800, unit: "box", packSize: 1, mrpPaise: 189000, hsn: "9018" },
  { key: "n95mask", name: "Venus V-4400 N95 Mask (5)", generic: "N95 Particulate Respirator", manufacturer: "Venus Safety & Health", category: "surgical", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 5, mrpPaise: 39900, hsn: "6307" },
  { key: "surgicalgloves", name: "Sterile Surgical Gloves Size 7", generic: "Latex Powdered Surgical Gloves (Pair)", manufacturer: "Nulife Sterile Products", category: "surgical", schedule: "OTC", gstBps: 1200, unit: "pack", packSize: 1, mrpPaise: 2900, hsn: "4015" },
  { key: "dispovan5ml", name: "Dispovan Syringe 5ml (100)", generic: "Sterile Disposable Syringe with Needle", manufacturer: "Hindustan Syringes & Medical Devices", category: "surgical", schedule: "OTC", gstBps: 1200, unit: "box", packSize: 100, mrpPaise: 52500, hsn: "9018" },
];

/** Schedule drives the prescription gate — the two must never drift apart. */
function needsPrescription(schedule: DrugSchedule): boolean {
  return schedule !== "OTC" && schedule !== "AYURVEDIC";
}

/** Cheap fast-movers need a deeper buffer than a ₹1,890 BP monitor. */
function reorderLevelFor(mrpPaise: number, rng: Rng): number {
  const base =
    mrpPaise < 5_000 ? 40 : mrpPaise < 15_000 ? 24 : mrpPaise < 40_000 ? 12 : 6;
  return base + intBetween(rng, 0, 2) * 4;
}

/** SKUs that carry a second barcode: relabelled vendor stock, alternate pack. */
const DUAL_BARCODE_KEYS: ReadonlySet<string> = new Set([
  "dolo650",
  "augmentin625",
  "pand",
  "shelcal500",
  "zincovit",
  "dettol",
  "electralors",
]);

function buildMedicines(rng: Rng): Medicine[] {
  const perCategoryCount = new Map<string, number>();
  let barcodeCursor = 0;

  return CATALOG.map((spec) => {
    const categorySpec =
      CATEGORY_SPECS.find((c) => c.key === spec.category) ?? CATEGORY_SPECS[0];
    const seq = (perCategoryCount.get(spec.category) ?? 0) + 1;
    perCategoryCount.set(spec.category, seq);

    const barcodes = [barcodeAt(barcodeCursor)];
    barcodeCursor += 1;
    if (DUAL_BARCODE_KEYS.has(spec.key)) {
      barcodes.push(barcodeAt(barcodeCursor + 500));
      barcodeCursor += 1;
    }

    return {
      id: `med_${spec.key}`,
      name: spec.name,
      genericName: spec.generic,
      manufacturer: spec.manufacturer,
      categoryId: `cat_${spec.category}`,
      schedule: spec.schedule,
      requiresPrescription: needsPrescription(spec.schedule),
      hsnCode: spec.hsn,
      gstBps: spec.gstBps,
      unitLabel: spec.unit,
      packSize: spec.packSize,
      reorderLevel: reorderLevelFor(spec.mrpPaise, rng),
      rackLocation: `${categorySpec.rackLetter}-${String(seq).padStart(2, "0")}`,
      barcodes,
      isActive: true,
    } satisfies Medicine;
  });
}

// ─────────────────────────── batches ───────────────────────────

const LOT_SUFFIX = ["a", "b", "c"] as const;

/**
 * Engineered expiry ladder. These are day offsets from `now`, handed out to a
 * shuffled list of lots so the counts are exact rather than probabilistic:
 * 6 already expired, 10 inside 30 days, 14 inside 90 days, everything else long.
 */
const EXPIRED_OFFSETS = [-95, -61, -40, -22, -12, -5];
const CRITICAL_OFFSETS = [4, 7, 9, 12, 15, 18, 21, 24, 27, 29];
const WARNING_OFFSETS = [34, 38, 42, 47, 52, 58, 63, 69, 74, 79, 83, 86, 88, 90];

interface BatchPlan {
  batch: Batch;
  /** Quantity the demo should SHOW after the seeded sales have been applied. */
  finalQuantity: number;
  receivedOffsetDays: number;
  expiryOffsetDays: number;
}

function batchNumberFor(index: number, expiryOffset: number, rng: Rng): string {
  // Two house styles, because real shelves carry stock from many packers.
  if (index % 2 === 0) {
    const year = 23 + ((index + Math.max(0, expiryOffset)) % 3);
    const letter = String.fromCharCode(65 + (index % 12));
    return `MFG${year}${letter}${String(100 + ((index * 17) % 890)).padStart(3, "0")}`;
  }
  const month = 1 + (index % 12);
  return `BT${23 + (index % 3)}${String(month).padStart(2, "0")}-${String(
    100 + intBetween(rng, 0, 880),
  )}`;
}

function buildBatchPlans(medicines: Medicine[], now: Date, rng: Rng): BatchPlan[] {
  // 1 — how many lots each SKU carries.
  const slots: Array<{ medicine: Medicine; lot: number }> = [];
  for (const medicine of medicines) {
    const roll = rng();
    const lots = roll < 0.36 ? 1 : roll < 0.87 ? 2 : 3;
    for (let lot = 0; lot < lots; lot += 1) slots.push({ medicine, lot });
  }

  // 2 — deal out the engineered expiry ladder, then long-dated for the remainder.
  const order = shuffled(
    slots.map((_, index) => index),
    rng,
  );
  const expiryOffsets = new Array<number>(slots.length).fill(0);
  let cursor = 0;
  for (const offset of [...EXPIRED_OFFSETS, ...CRITICAL_OFFSETS, ...WARNING_OFFSETS]) {
    expiryOffsets[order[cursor]] = offset;
    cursor += 1;
  }
  for (; cursor < order.length; cursor += 1) {
    expiryOffsets[order[cursor]] = intBetween(rng, 185, 1_090);
  }

  // 3 — pick which SKUs read OUT and which read LOW on the shelf report.
  //     OUT is only handed to single-lot, non-expired SKUs so the count of
  //     zero-quantity lots lands exactly on 8 rather than drifting with lot count.
  const lotsByMedicine = new Map<string, number[]>();
  slots.forEach((slot, index) => {
    const list = lotsByMedicine.get(slot.medicine.id) ?? [];
    list.push(index);
    lotsByMedicine.set(slot.medicine.id, list);
  });

  const singleLotLive: string[] = [];
  const multiLotLive: string[] = [];
  for (const medicine of medicines) {
    const indices = lotsByMedicine.get(medicine.id) ?? [];
    const live = indices.filter((i) => expiryOffsets[i] >= 0);
    if (live.length === 0) continue;
    if (indices.length === 1) singleLotLive.push(medicine.id);
    else multiLotLive.push(medicine.id);
  }

  const outMedicines = new Set(shuffled(singleLotLive, rng).slice(0, 8));
  const lowPool = shuffled(
    [...singleLotLive.filter((id) => !outMedicines.has(id)), ...multiLotLive],
    rng,
  );
  const lowMedicines = new Set(lowPool.slice(0, 12));

  // 4 — materialise the lots.
  const plans: BatchPlan[] = [];
  const specByKey = new Map(CATALOG.map((spec) => [`med_${spec.key}`, spec]));

  slots.forEach((slot, index) => {
    const spec = specByKey.get(slot.medicine.id);
    if (!spec) return;

    const expiryOffsetDays = expiryOffsets[index];
    const expired = expiryOffsetDays < 0;

    // Received: work back from expiry by a plausible shelf life, then clamp into
    // a window that keeps every lot older than the oldest seeded bill.
    const shelfLifeDays = intBetween(rng, 380, 900);
    let receivedOffsetDays = expiryOffsetDays - shelfLifeDays;
    if (receivedOffsetDays > -24) receivedOffsetDays = -24 - intBetween(rng, 0, 70);
    if (receivedOffsetDays < -430) receivedOffsetDays = -430 + intBetween(rng, 0, 45);

    // Older lots were bought at an older MRP; the current lot carries the printed one.
    const mrpPaise =
      slot.lot === 0 ? spec.mrpPaise : Math.round((spec.mrpPaise * (100 - slot.lot * 2)) / 100);

    const costRatioBps = intBetween(rng, 5_500, 7_500);
    const costPaise = Math.round((mrpPaise * costRatioBps) / 10_000);

    // ~15% of lots go out below MRP (scheme stock, near-dated push). Never above.
    const discounted = rng() < 0.15;
    const sellingPaise = discounted
      ? Math.min(mrpPaise, Math.round((mrpPaise * (10_000 - intBetween(rng, 300, 1_000))) / 10_000))
      : mrpPaise;

    const reorder = slot.medicine.reorderLevel;
    let finalQuantity: number;
    if (expired) {
      finalQuantity = intBetween(rng, 3, 20); // still physically on the shelf
    } else if (outMedicines.has(slot.medicine.id)) {
      finalQuantity = 0;
    } else if (lowMedicines.has(slot.medicine.id)) {
      const liveLots = (lotsByMedicine.get(slot.medicine.id) ?? []).filter(
        (i) => expiryOffsets[i] >= 0,
      ).length;
      const target = intBetween(rng, 1, Math.max(1, Math.floor(reorder * 0.9)));
      finalQuantity = Math.max(1, Math.round(target / Math.max(1, liveLots)));
    } else {
      finalQuantity = Math.round(reorder * (1.7 + rng() * 3.1));
    }

    const supplier = pick(SUPPLIERS, rng);
    const invoicePrefix = SUPPLIER_INVOICE_PREFIX[supplier.id] ?? "GEN";

    plans.push({
      finalQuantity,
      receivedOffsetDays,
      expiryOffsetDays,
      batch: {
        id: `bat_${spec.key}_${LOT_SUFFIX[slot.lot] ?? String(slot.lot)}`,
        medicineId: slot.medicine.id,
        batchNumber: batchNumberFor(index, expiryOffsetDays, rng),
        expiryDate: isoDay(now, expiryOffsetDays),
        quantity: finalQuantity,
        mrpPaise,
        costPaise,
        sellingPaise,
        supplierId: supplier.id,
        invoiceRef: `${invoicePrefix}/24-25/${1_000 + ((index * 37) % 8_500)}`,
        receivedAt: isoAt(now, receivedOffsetDays, 10, (index * 13) % 60),
      },
    });
  });

  return plans;
}

// ─────────────────────────── bills ───────────────────────────

const CUSTOMER_NAMES = [
  "Shruti Kulkarni",
  "Vikram Rao",
  "Meera Nair",
  "Arjun Prasad",
  "Fatima Sheikh",
  "Rohit Bhandari",
  "Lakshmi Subramanian",
  "Imran Pasha",
  "Deepa Shetty",
  "Suresh Gowda",
  "Nandini Hegde",
  "Aakash Verma",
  "Pooja Mehta",
  "Manjunath B",
  "Rekha Joshi",
  "Sameer Chatterjee",
  "Divya Raghavan",
  "Harish Kamath",
] as const;

const DOCTOR_NAMES = [
  "Dr. Anil Kumar",
  "Dr. Sheela Rangan",
  "Dr. P. Venkatesh",
  "Dr. Nisha Fernandes",
  "Dr. Girish Naik",
] as const;

const PAYER_VPAS = [
  "shruti.k@okaxis",
  "vikram9845@ybl",
  "meera.nair@okicici",
  "arjun.p@paytm",
  "9880041276@ibl",
  "rohitb@okhdfcbank",
  "deepa.shetty@upi",
  "imran.pasha@okaxis",
] as const;

const BILL_COUNT = 28;
const INVOICE_START = 391;

interface BillBuildResult {
  bills: Bill[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
  soldByBatch: Map<string, number>;
  lastInvoiceNumber: number;
}

function buildBills(
  medicines: Medicine[],
  plans: BatchPlan[],
  settings: ShopSettings,
  feeConfig: FeeConfig,
  now: Date,
  rng: Rng,
): BillBuildResult {
  const medicineById = new Map(medicines.map((m) => [m.id, m]));
  const planByBatchId = new Map(plans.map((p) => [p.batch.id, p]));
  const cashiers = STAFF.filter((s) => s.role !== "OWNER");

  // Lots that must end at zero have to have actually SOLD something, otherwise
  // their opening purchase would be zero and the ledger would show a lot that
  // never existed. Force each of them onto one of the most recent bills.
  const zeroPlans = plans.filter((p) => p.finalQuantity === 0);
  const forcedByBill = new Map<number, string[]>();
  zeroPlans.forEach((plan, i) => {
    const billIndex = BILL_COUNT - 1 - (i % 8);
    const list = forcedByBill.get(billIndex) ?? [];
    list.push(plan.batch.id);
    forcedByBill.set(billIndex, list);
  });

  const bills: Bill[] = [];
  const payments: Payment[] = [];
  const webhookEvents: WebhookEvent[] = [];
  const soldByBatch = new Map<string, number>();

  let invoiceNumber = INVOICE_START - 1;
  let paymentSeq = 0;

  for (let b = 0; b < BILL_COUNT; b += 1) {
    const dayOffset = -20 + Math.floor((b * 20) / (BILL_COUNT - 1));
    const hour = 9 + ((b * 7) % 12);
    const minute = (b * 17) % 60;
    const createdAt = isoAt(now, dayOffset, hour, minute);

    const eligible = plans.filter(
      (p) =>
        p.receivedOffsetDays <= dayOffset &&
        p.expiryOffsetDays > dayOffset &&
        (soldByBatch.get(p.batch.id) ?? 0) < 26,
    );
    if (eligible.length === 0) continue;

    const forced = forcedByBill.get(b) ?? [];
    const targetLines = Math.max(forced.length, intBetween(rng, 1, 6));

    const chosen: BatchPlan[] = [];
    const seen = new Set<string>();
    for (const batchId of forced) {
      const plan = planByBatchId.get(batchId);
      if (plan && !seen.has(batchId)) {
        chosen.push(plan);
        seen.add(batchId);
      }
    }
    let guard = 0;
    while (chosen.length < targetLines && guard < 60) {
      guard += 1;
      const candidate = pick(eligible, rng);
      if (seen.has(candidate.batch.id)) continue;
      chosen.push(candidate);
      seen.add(candidate.batch.id);
    }
    if (chosen.length === 0) continue;

    invoiceNumber += 1;
    const billId = `bill_${String(invoiceNumber)}`;

    const items: BillItem[] = [];
    let subtotalPaise = 0;
    let discountPaise = 0;
    let taxPaise = 0;
    let hasScheduled = false;

    chosen.forEach((plan, lineIndex) => {
      const medicine = medicineById.get(plan.batch.medicineId);
      if (!medicine) return;

      // Expensive devices go out one at a time; strips go out in twos and threes.
      const maxQty = plan.batch.mrpPaise > 40_000 ? 1 : plan.batch.mrpPaise > 15_000 ? 2 : 3;
      const quantity = intBetween(rng, 1, maxQty);

      const unitPricePaise = Math.min(plan.batch.sellingPaise, plan.batch.mrpPaise);
      const perUnitDiscount =
        rng() < 0.18 ? Math.round((unitPricePaise * intBetween(rng, 200, 700)) / 10_000) : 0;
      const grossPaise = unitPricePaise * quantity;
      const lineDiscount = perUnitDiscount * quantity;
      const lineTotalPaise = grossPaise - lineDiscount;
      const lineTax = extractInclusiveTax(lineTotalPaise, medicine.gstBps);

      if (medicine.requiresPrescription) hasScheduled = true;

      subtotalPaise += grossPaise;
      discountPaise += lineDiscount;
      taxPaise += lineTax;

      items.push({
        id: `bli_${invoiceNumber}_${lineIndex + 1}`,
        medicineId: medicine.id,
        batchId: plan.batch.id,
        nameSnapshot: medicine.name,
        genericSnapshot: medicine.genericName,
        batchNumberSnapshot: plan.batch.batchNumber,
        expirySnapshot: plan.batch.expiryDate,
        hsnSnapshot: medicine.hsnCode,
        unitLabel: medicine.unitLabel,
        quantity,
        mrpPaise: plan.batch.mrpPaise,
        unitPricePaise,
        discountPaise: lineDiscount,
        gstBps: medicine.gstBps,
        taxPaise: lineTax,
        lineTotalPaise,
      });

      soldByBatch.set(plan.batch.id, (soldByBatch.get(plan.batch.id) ?? 0) + quantity);
    });

    if (items.length === 0) {
      invoiceNumber -= 1;
      continue;
    }

    const { rounded, delta } = roundOffToRupee(subtotalPaise - discountPaise);
    const method = rng() < 0.42 ? "UPI" : "CASH";
    // Cash never touches a gateway, so there is nothing to gross up.
    const fees = computeFees(rounded, feeConfig);
    const convenienceFeePaise = method === "UPI" ? fees.convenienceFeePaise : 0;

    const cashier = cashiers[b % cashiers.length];
    const named = rng() < 0.68;
    const customerName = named ? pick(CUSTOMER_NAMES, rng) : undefined;

    const bill: Bill = {
      id: billId,
      billNumber: `${settings.invoicePrefix}${String(invoiceNumber).padStart(5, "0")}`,
      status: "PAID",
      customerName,
      customerPhone: named ? `+91 9${String(800_000_000 + intBetween(rng, 0, 99_999_999))}` : undefined,
      doctorName: hasScheduled ? pick(DOCTOR_NAMES, rng) : undefined,
      prescriptionRef: hasScheduled ? `RX-${8_000 + intBetween(rng, 0, 1_900)}` : undefined,
      items,
      subtotalPaise,
      discountPaise,
      taxPaise,
      roundOffPaise: delta,
      totalPaise: rounded,
      convenienceFeePaise,
      payablePaise: rounded + convenienceFeePaise,
      method,
      cashierId: cashier.id,
      stockCommitted: true,
      createdAt,
      paidAt: isoAt(now, dayOffset, hour, minute + 2),
    };
    bills.push(bill);

    if (method === "UPI") {
      paymentSeq += 1;
      const paymentId = `pay_${String(paymentSeq).padStart(4, "0")}`;
      const gatewayFeePaise = computeFees(bill.totalPaise, feeConfig).gatewayFeePaise;
      payments.push({
        id: paymentId,
        billId: bill.id,
        provider: "mock",
        status: "PAID",
        amountPaise: bill.payablePaise,
        gatewayFeePaise,
        netPaise: bill.payablePaise - gatewayFeePaise,
        providerQrId: `qr_${paymentId}`,
        providerPaymentId: `mock_pay_${String(70_000 + paymentSeq * 137)}`,
        upiUri: `upi://pay?pa=${settings.upiVpa}&pn=${encodeURIComponent(
          settings.upiPayeeName,
        )}&am=${(bill.payablePaise / 100).toFixed(2)}&cu=INR&tr=${bill.billNumber}&tn=${
          encodeURIComponent(`Bill ${bill.billNumber}`)
        }`,
        payerVpa: pick(PAYER_VPAS, rng),
        expiresAt: isoAt(now, dayOffset, hour, minute + 10),
        createdAt,
        paidAt: isoAt(now, dayOffset, hour, minute + 2),
      });
    }
  }

  // A couple of archived gateway events so the payment inspector has history on
  // first load — including one duplicate delivery that the replay guard ignored.
  const sampleA = payments[payments.length - 1];
  const sampleB = payments[Math.max(0, payments.length - 4)];
  if (sampleA) {
    const payload = {
      event: "payment.captured",
      payment_id: sampleA.providerPaymentId,
      bill_id: sampleA.billId,
      amount: sampleA.amountPaise,
      currency: "INR",
      vpa: sampleA.payerVpa,
    };
    const raw = JSON.stringify(payload);
    webhookEvents.push({
      id: "whk_0001",
      provider: "mock",
      eventId: `evt_${sampleA.id}_captured`,
      eventType: "payment.captured",
      status: "PROCESSED",
      signature: signPayload(raw),
      payload,
      receivedAt: sampleA.paidAt ?? sampleA.createdAt,
      processedAt: sampleA.paidAt ?? sampleA.createdAt,
    });
  }
  if (sampleB) {
    const payload = {
      event: "payment.captured",
      payment_id: sampleB.providerPaymentId,
      bill_id: sampleB.billId,
      amount: sampleB.amountPaise,
      currency: "INR",
      vpa: sampleB.payerVpa,
      attempt: 2,
    };
    const raw = JSON.stringify(payload);
    webhookEvents.push({
      id: "whk_0002",
      provider: "mock",
      eventId: `evt_${sampleB.id}_captured_retry`,
      eventType: "payment.captured",
      status: "IGNORED",
      signature: signPayload(raw),
      payload,
      note: "Duplicate delivery — stock already committed for this bill.",
      receivedAt: sampleB.paidAt ?? sampleB.createdAt,
      processedAt: sampleB.paidAt ?? sampleB.createdAt,
    });
  }

  return { bills, payments, webhookEvents, soldByBatch, lastInvoiceNumber: invoiceNumber };
}

// ─────────────────────────── ledger ───────────────────────────

/**
 * Rebuild the movement ledger so `Batch.quantity` is provably the sum of it.
 *
 * The seed works backwards: the engineered figure is the quantity the demo should
 * SHOW today, so the opening purchase is that figure plus everything the seeded
 * bills sold. Replaying purchases then sales in date order lands exactly on it.
 */
function buildMovements(
  plans: BatchPlan[],
  bills: Bill[],
  soldByBatch: Map<string, number>,
): StockMovement[] {
  const movements: StockMovement[] = [];
  const balances = new Map<string, number>();
  let seq = 0;
  const nextId = (): string => {
    seq += 1;
    return `mov_${String(seq).padStart(4, "0")}`;
  };

  for (const plan of plans) {
    const opening = plan.finalQuantity + (soldByBatch.get(plan.batch.id) ?? 0);
    balances.set(plan.batch.id, opening);
    if (opening === 0) continue;
    movements.push({
      id: nextId(),
      batchId: plan.batch.id,
      medicineId: plan.batch.medicineId,
      type: "PURCHASE",
      quantity: opening,
      balanceAfter: opening,
      reason: plan.batch.invoiceRef ? `Goods inward ${plan.batch.invoiceRef}` : "Goods inward",
      staffId: "stf_ananya",
      createdAt: plan.batch.receivedAt,
    });
  }

  const chronological = bills
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const bill of chronological) {
    for (const item of bill.items) {
      const balance = (balances.get(item.batchId) ?? 0) - item.quantity;
      balances.set(item.batchId, balance);
      movements.push({
        id: nextId(),
        batchId: item.batchId,
        medicineId: item.medicineId,
        type: "SALE",
        quantity: -item.quantity,
        balanceAfter: balance,
        billId: bill.id,
        staffId: bill.cashierId,
        createdAt: bill.paidAt ?? bill.createdAt,
      });
    }
  }

  movements.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return movements;
}

// ─────────────────────────── settings ───────────────────────────

function buildSettings(): ShopSettings {
  return {
    shopName: "Meridian Pharmacy",
    legalName: "Meridian Retail Pharmacy Pvt Ltd",
    addressLine1: "No. 42, 4th Cross, 100 Feet Road",
    addressLine2: "HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    phone: "+91 80 4512 7788",
    email: "counter@meridianpharmacy.in",
    gstin: "29AAJCM8821K1ZQ",
    drugLicenseNo: "KA-B-20/2019-1147, KA-B-21/2019-1148",
    upiVpa: "meridianpharmacy@okhdfcbank",
    upiPayeeName: "Meridian Pharmacy",
    invoicePrefix: "INV-24",
    // Holds the LAST issued serial; the store pre-increments before printing.
    invoiceCounter: INVOICE_START - 1,
    expiryWarningDays: 90,
  };
}

function buildFeeConfig(): FeeConfig {
  return {
    mode: "PASS_TO_CUSTOMER",
    percentBps: 200,
    fixedPaise: 0,
    gstOnFeeBps: 1800,
    passSharePercent: 50,
    roundToPaise: 100,
    showOnBill: true,
    label: "Convenience fee",
  };
}

// ─────────────────────────── assembly ───────────────────────────

export interface SeedData {
  categories: Category[];
  suppliers: Supplier[];
  staff: Staff[];
  medicines: Medicine[];
  batches: Batch[];
  movements: StockMovement[];
  bills: Bill[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
  settings: ShopSettings;
  feeConfig: FeeConfig;
}

export function buildSeed(now: Date = seedNow()): SeedData {
  const day = seedNow(now);
  const rng = mulberry32(SEED_CONSTANT);

  const categories = buildCategories();
  const medicines = buildMedicines(rng);
  const plans = buildBatchPlans(medicines, day, rng);

  const settings = buildSettings();
  const feeConfig = buildFeeConfig();

  const { bills, payments, webhookEvents, soldByBatch, lastInvoiceNumber } = buildBills(
    medicines,
    plans,
    settings,
    feeConfig,
    day,
    rng,
  );

  settings.invoiceCounter = lastInvoiceNumber;

  const movements = buildMovements(plans, bills, soldByBatch);
  const batches = plans.map((plan) => plan.batch);

  return {
    categories,
    suppliers: SUPPLIERS.map((s) => ({ ...s })),
    staff: STAFF.map((s) => ({ ...s })),
    medicines,
    batches,
    movements,
    bills,
    payments,
    webhookEvents,
    settings,
    feeConfig,
  };
}
