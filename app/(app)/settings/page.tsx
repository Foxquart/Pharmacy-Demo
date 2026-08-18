"use client";

/**
 * Owner-only configuration: who the shop is on an invoice, and how the gateway
 * cut is carried.
 *
 * The fee panel is the reason this page exists. It runs the real `computeFees`
 * on a sample total as the owner types, and prints the naive answer beside it,
 * because "add 2%" is wrong in a way that is invisible until you reconcile a
 * bank statement.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowCounterClockwise, Lock, Storefront } from "@phosphor-icons/react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  NumberInput,
  Segmented,
  Select,
  SelectContent,
  SelectField,
  SelectItem,
  SelectValue,
  Skeleton,
  SkeletonText,
} from "@/components/ui";
import { CAN_EDIT_FEES, ROLE_LABEL } from "@/components/app/nav";
import {
  applyBps,
  computeFees,
  formatBps,
  formatPaise,
  rupeesToPaise,
  type FeeBreakdown,
} from "@/lib/domain/money";
import type { FeeConfig, FeeMode, ShopSettings } from "@/lib/domain/types";
import { usePharmacyStore, useCurrentStaff, useHydrated } from "@/lib/store/pharmacy-store";
import { cn } from "@/lib/utils";

// ─────────────────────────── input parsing ───────────────────────────

/** A half-typed field is 0, never NaN. Negative money is not a fee policy. */
function parseAmount(text: string): number {
  const value = Number(text.trim());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Percent → basis points. Same operation as rupees → paise (multiply by a
 * hundred and round to an integer), so it reuses the audited implementation
 * rather than open-coding a second one that could round differently.
 */
function percentToBps(percent: number): number {
  return rupeesToPaise(percent);
}

/** bps → the percent string the owner typed, e.g. `236` → "2.36". */
function bpsToPercentText(bps: number): string {
  return (bps / 100).toFixed(2);
}

/** paise → the rupee string the owner typed, e.g. `48500` → "485.00". */
function paiseToRupeeText(paise: number): string {
  return (paise / 100).toFixed(2);
}

function parseWholeNumber(text: string, fallback: number, min: number, max: number): number {
  const value = Math.trunc(Number(text.trim()));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────── shop details ───────────────────────────

interface ShopField {
  key: keyof Omit<ShopSettings, "invoiceCounter" | "expiryWarningDays">;
  label: string;
  helperText?: string;
  span?: boolean;
  inputMode?: "text" | "tel" | "email" | "numeric";
}

const SHOP_FIELDS: ShopField[] = [
  { key: "shopName", label: "Shop name", helperText: "Printed at the top of every invoice." },
  { key: "legalName", label: "Legal name" },
  { key: "addressLine1", label: "Address line 1", span: true },
  { key: "addressLine2", label: "Address line 2", span: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode", inputMode: "numeric" },
  { key: "phone", label: "Phone", inputMode: "tel" },
  { key: "email", label: "Email", inputMode: "email", span: true },
  { key: "gstin", label: "GSTIN", helperText: "15 characters, as issued." },
  { key: "drugLicenseNo", label: "Drug licence number", helperText: "Both wholesale and retail." },
  { key: "upiVpa", label: "UPI VPA", helperText: "The address every QR at the counter pays into." },
  { key: "upiPayeeName", label: "UPI payee name", helperText: "What the payer's app shows them." },
  { key: "invoicePrefix", label: "Invoice prefix", helperText: "Serial numbers continue from the counter." },
];

type ShopDraft = Record<ShopField["key"], string> & { expiryWarningDays: string };

function toShopDraft(settings: ShopSettings): ShopDraft {
  return {
    shopName: settings.shopName,
    legalName: settings.legalName,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    city: settings.city,
    state: settings.state,
    pincode: settings.pincode,
    phone: settings.phone,
    email: settings.email,
    gstin: settings.gstin,
    drugLicenseNo: settings.drugLicenseNo,
    upiVpa: settings.upiVpa,
    upiPayeeName: settings.upiPayeeName,
    invoicePrefix: settings.invoicePrefix,
    expiryWarningDays: String(settings.expiryWarningDays),
  };
}

function ShopDetailsPanel({
  settings,
  onSave,
}: {
  settings: ShopSettings;
  onSave: (patch: Partial<ShopSettings>) => void;
}) {
  const [draft, setDraft] = React.useState<ShopDraft>(() => toShopDraft(settings));
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const baseline = React.useMemo(() => toShopDraft(settings), [settings]);
  const dirty = React.useMemo(
    () => (Object.keys(baseline) as Array<keyof ShopDraft>).some((k) => baseline[k] !== draft[k]),
    [baseline, draft],
  );

  function set(key: keyof ShopDraft, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function save() {
    const text = Object.fromEntries(
      SHOP_FIELDS.map((field) => [field.key, draft[field.key].trim()]),
    ) as Partial<ShopSettings>;
    onSave({
      ...text,
      expiryWarningDays: parseWholeNumber(draft.expiryWarningDays, 90, 7, 365),
    });
    setSavedAt(Date.now());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop details</CardTitle>
        <CardDescription>
          Everything here prints on an invoice or is read back by a UPI app at the moment of
          payment, so it has to match what the licence and the bank account say.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHOP_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              helperText={field.helperText}
              inputMode={field.inputMode}
              value={draft[field.key]}
              onChange={(event) => set(field.key, event.target.value)}
              fieldClassName={field.span ? "sm:col-span-2" : undefined}
            />
          ))}
          <NumberInput
            label="Expiry warning days"
            helperText="How early a lot starts showing amber in stock views."
            value={draft.expiryWarningDays}
            onChange={(event) => set("expiryWarningDays", event.target.value)}
          />
          <Input
            label="Next invoice serial"
            value={`${draft.invoicePrefix}${String(settings.invoiceCounter + 1).padStart(5, "0")}`}
            readOnly
            disabled
            helperText="Issued by the counter. Not editable here."
            className="numeric"
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button size="sm" className="max-sm:h-11" onClick={save} disabled={!dirty}>
          Save shop details
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="max-sm:h-11"
          onClick={() => {
            setDraft(toShopDraft(settings));
            setSavedAt(null);
          }}
          disabled={!dirty}
          leftIcon={<ArrowCounterClockwise size={14} />}
        >
          Discard
        </Button>
        <span className="ml-auto text-[0.75rem] text-text-tertiary">
          {dirty ? "Unsaved changes" : savedAt ? "Saved" : "Up to date"}
        </span>
      </CardFooter>
    </Card>
  );
}

// ─────────────────────────── fee policy ───────────────────────────

const MODE_OPTIONS: Array<{ value: FeeMode; label: string }> = [
  { value: "ABSORB", label: "Absorb" },
  { value: "PASS_TO_CUSTOMER", label: "Pass to customer" },
  { value: "SPLIT", label: "Split" },
];

const MODE_BLURB: Record<FeeMode, string> = {
  ABSORB: "The customer pays the bill total exactly. The shop takes the gateway cut on the chin.",
  PASS_TO_CUSTOMER:
    "The bill is grossed up so that after the gateway deducts its cut, the shop still receives the full bill total.",
  SPLIT: "A configurable share of the gross-up is added to the bill; the shop carries the rest.",
};

interface FeeDraft {
  mode: FeeMode;
  percentText: string;
  fixedRupeesText: string;
  gstText: string;
  passShareText: string;
  roundToPaise: string;
  showOnBill: "SHOW" | "HIDE";
  label: string;
}

function toFeeDraft(config: FeeConfig): FeeDraft {
  return {
    mode: config.mode,
    percentText: bpsToPercentText(config.percentBps),
    fixedRupeesText: paiseToRupeeText(config.fixedPaise),
    gstText: bpsToPercentText(config.gstOnFeeBps),
    passShareText: String(config.passSharePercent),
    roundToPaise: String(config.roundToPaise),
    showOnBill: config.showOnBill ? "SHOW" : "HIDE",
    label: config.label,
  };
}

function LedgerRow({
  label,
  value,
  hint,
  tone = "neutral",
  strong = false,
  divider = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "muted" | "success" | "danger";
  strong?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2",
        divider && "border-t border-border",
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[0.8125rem]",
            strong ? "font-medium text-text" : "text-text-secondary",
          )}
        >
          {label}
        </span>
        {hint ? <span className="block text-[0.6875rem] text-text-tertiary">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "numeric shrink-0",
          strong ? "text-[1.0625rem] font-medium" : "text-[0.875rem]",
          tone === "success" && "text-success-text",
          tone === "danger" && "text-danger-text",
          tone === "muted" && "text-text-tertiary",
          tone === "neutral" && "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function WorkedExample({
  samplePaise,
  breakdown,
  config,
}: {
  samplePaise: number;
  breakdown: FeeBreakdown;
  config: FeeConfig;
}) {
  const whole = breakdown.shortfallPaise >= 0;

  /* The naive answer: add the headline percentage to the bill and charge that.
     Both legs are integer paise and every rate is applied with `applyBps`, the
     same helper `computeFees` uses, so the two columns are comparable. */
  const naiveChargePaise =
    samplePaise + applyBps(samplePaise, config.percentBps) + config.fixedPaise;
  const naiveGatewayFeePaise =
    applyBps(naiveChargePaise, breakdown.effectiveRateBps) + config.fixedPaise;
  const naiveNetPaise = naiveChargePaise - naiveGatewayFeePaise;
  const naiveShortfallPaise = naiveNetPaise - samplePaise;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        className={cn(
          "rounded-[var(--radius-lg)] border p-4",
          whole ? "border-success-border bg-success-subtle" : "border-danger-border bg-danger-subtle",
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="text-[0.8125rem] font-medium text-text">
            Solved: C = T / (1 − R)
          </h3>
          <Badge size="sm" tone={whole ? "success" : "danger"} dot>
            {whole ? "Shop is whole" : "Shop is short"}
          </Badge>
        </div>

        <div className="rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-1">
          <LedgerRow label="Bill total, what the shop is owed" value={formatPaise(samplePaise)} />
          <LedgerRow
            divider
            label={config.label || "Convenience fee"}
            hint={
              config.mode === "ABSORB"
                ? "Absorb mode adds nothing to the bill"
                : config.mode === "SPLIT"
                  ? `${config.passSharePercent}% of the gross-up, rounded up to ${
                      config.roundToPaise === 100 ? "the rupee" : "the paise"
                    }`
                  : `Rounded up to ${config.roundToPaise === 100 ? "the rupee" : "the paise"}`
            }
            value={`+ ${formatPaise(breakdown.convenienceFeePaise)}`}
            tone={breakdown.convenienceFeePaise > 0 ? "neutral" : "muted"}
          />
          <LedgerRow
            divider
            label="Customer pays"
            hint="The amount the QR asks for"
            value={formatPaise(breakdown.payablePaise)}
            strong
          />
          <LedgerRow
            divider
            label="Gateway takes"
            hint={`${formatBps(breakdown.effectiveRateBps)} of what it captures, GST on the fee included`}
            value={`− ${formatPaise(breakdown.gatewayFeePaise)}`}
            tone="danger"
          />
          <LedgerRow
            divider
            label="Shop receives"
            value={formatPaise(breakdown.netToShopPaise)}
            strong
            tone={whole ? "success" : "danger"}
          />
        </div>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-text">
          {whole ? (
            <>
              The shop keeps its full{" "}
              <span className="numeric font-medium">{formatPaise(samplePaise)}</span>, with{" "}
              <span className="numeric font-medium text-success-text">
                {formatPaise(breakdown.shortfallPaise)}
              </span>{" "}
              to spare from the rounding.
            </>
          ) : (
            <>
              The shop lands{" "}
              <span className="numeric font-medium text-danger-text">
                {formatPaise(Math.abs(breakdown.shortfallPaise))}
              </span>{" "}
              below the bill total on this sale.
            </>
          )}
        </p>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border bg-bg-sunken p-4">
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="text-[0.8125rem] font-medium text-text">
            Naive: total + {formatBps(config.percentBps)}
          </h3>
          <Badge size="sm" tone={naiveShortfallPaise >= 0 ? "success" : "danger"} dot>
            {naiveShortfallPaise >= 0 ? "Shop is whole" : "Shop is short"}
          </Badge>
        </div>

        <div className="rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-1">
          <LedgerRow label="Bill total, what the shop is owed" value={formatPaise(samplePaise)} />
          <LedgerRow
            divider
            label={`Headline ${formatBps(config.percentBps)} added on top`}
            value={`+ ${formatPaise(naiveChargePaise - samplePaise)}`}
          />
          <LedgerRow
            divider
            label="Customer pays"
            value={formatPaise(naiveChargePaise)}
            strong
          />
          <LedgerRow
            divider
            label="Gateway takes"
            hint={`Still ${formatBps(breakdown.effectiveRateBps)}, and now it taxes the add-on too`}
            value={`− ${formatPaise(naiveGatewayFeePaise)}`}
            tone="danger"
          />
          <LedgerRow
            divider
            label="Shop receives"
            value={formatPaise(naiveNetPaise)}
            strong
            tone={naiveShortfallPaise >= 0 ? "success" : "danger"}
          />
        </div>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-text">
          Short by{" "}
          <span className="numeric font-medium text-danger-text">
            {formatPaise(Math.abs(naiveShortfallPaise))}
          </span>{" "}
          on this one sale, and it is short on every sale, quietly, forever.
        </p>
      </section>
    </div>
  );
}

function FeePolicyPanel({
  config,
  onSave,
}: {
  config: FeeConfig;
  onSave: (patch: Partial<FeeConfig>) => void;
}) {
  const [draft, setDraft] = React.useState<FeeDraft>(() => toFeeDraft(config));
  const [sampleText, setSampleText] = React.useState("485.00");

  function set<K extends keyof FeeDraft>(key: K, value: FeeDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // The draft is turned into a real FeeConfig on every keystroke, so the worked
  // example below is computed by exactly the code the counter runs.
  const draftConfig = React.useMemo<FeeConfig>(
    () => ({
      mode: draft.mode,
      percentBps: percentToBps(parseAmount(draft.percentText)),
      fixedPaise: rupeesToPaise(parseAmount(draft.fixedRupeesText)),
      gstOnFeeBps: percentToBps(parseAmount(draft.gstText)),
      passSharePercent: parseWholeNumber(draft.passShareText, 50, 0, 100),
      roundToPaise: draft.roundToPaise === "100" ? 100 : 1,
      showOnBill: draft.showOnBill === "SHOW",
      label: draft.label,
    }),
    [draft],
  );

  const samplePaise = rupeesToPaise(parseAmount(sampleText));
  const breakdown = React.useMemo(
    () => computeFees(samplePaise, draftConfig),
    [samplePaise, draftConfig],
  );

  // Field by field rather than a stringify, so key order can never make an
  // unchanged policy claim it has unsaved edits.
  const dirty =
    draftConfig.mode !== config.mode ||
    draftConfig.percentBps !== config.percentBps ||
    draftConfig.fixedPaise !== config.fixedPaise ||
    draftConfig.gstOnFeeBps !== config.gstOnFeeBps ||
    draftConfig.passSharePercent !== config.passSharePercent ||
    draftConfig.roundToPaise !== config.roundToPaise ||
    draftConfig.showOnBill !== config.showOnBill ||
    draftConfig.label !== config.label;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Payment fee policy</CardTitle>
            <CardDescription>
              The gateway charges its cut on what it captures, not on what you want to receive, so
              the amount charged has to be solved for rather than marked up.
            </CardDescription>
          </div>
          <Badge tone={dirty ? "warning" : "neutral"} dot>
            {dirty ? "Unsaved" : "In force"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* mode */}
        <div className="flex flex-col gap-2">
          <span className="text-[0.8125rem] font-medium text-text">Who carries the cut</span>
          <div className="max-sm:-mx-1 max-sm:overflow-x-auto max-sm:px-1 max-sm:py-0.5">
            <Segmented<FeeMode>
              aria-label="Fee mode"
              value={draft.mode}
              onValueChange={(value) => set("mode", value)}
              options={MODE_OPTIONS}
            />
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-text-secondary">
            {MODE_BLURB[draft.mode]}
          </p>
        </div>

        {/* numbers */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NumberInput
            label="Gateway percentage"
            trailing={<span className="text-[0.75rem] text-text-tertiary">%</span>}
            helperText="Razorpay standard is 2.00. Stored as basis points."
            value={draft.percentText}
            onChange={(event) => set("percentText", event.target.value)}
          />
          <NumberInput
            label="Flat component"
            leadingIcon={<span className="text-[0.75rem] text-text-tertiary">₹</span>}
            helperText="Per transaction, if the plan has one. Entered in rupees."
            value={draft.fixedRupeesText}
            onChange={(event) => set("fixedRupeesText", event.target.value)}
          />
          <NumberInput
            label="GST on the gateway fee"
            trailing={<span className="text-[0.75rem] text-text-tertiary">%</span>}
            helperText="India charges 18% on the fee itself."
            value={draft.gstText}
            onChange={(event) => set("gstText", event.target.value)}
          />
          {draft.mode === "SPLIT" ? (
            <NumberInput
              label="Customer's share"
              trailing={<span className="text-[0.75rem] text-text-tertiary">%</span>}
              helperText="How much of the gross-up goes onto the bill."
              value={draft.passShareText}
              onChange={(event) => set("passShareText", event.target.value)}
            />
          ) : null}
          <Select
            value={draft.roundToPaise}
            onValueChange={(value) => set("roundToPaise", value)}
          >
            <SelectField
              label="Round the fee up to"
              helperText="Whole rupees keeps a QR from asking for ₹487.32."
            >
              <SelectValue />
            </SelectField>
            <SelectContent>
              <SelectItem value="1">Nearest paise</SelectItem>
              <SelectItem value="100">Nearest rupee</SelectItem>
            </SelectContent>
          </Select>
          <Input
            label="Label on the bill"
            helperText="What the customer reads on the printed line."
            value={draft.label}
            onChange={(event) => set("label", event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-text">Show on the bill</span>
            <Segmented<"SHOW" | "HIDE">
              aria-label="Show the fee line on the printed bill"
              size="sm"
              value={draft.showOnBill}
              onValueChange={(value) => set("showOnBill", value)}
              options={[
                { value: "SHOW", label: "Show the line" },
                { value: "HIDE", label: "Hide it" },
              ]}
            />
            <span className="text-[0.75rem] text-text-tertiary">
              Hiding it does not remove the charge, only the printed line.
            </span>
          </div>
        </div>

        {/* worked example */}
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-[0.9375rem] font-medium text-text">Worked example</h3>
              <p className="mt-0.5 text-[0.8125rem] text-text-secondary">
                Live, on the settings above. Change a number and both ledgers move.
              </p>
            </div>
            <NumberInput
              label="Sample bill total"
              leadingIcon={<span className="text-[0.75rem] text-text-tertiary">₹</span>}
              value={sampleText}
              onChange={(event) => setSampleText(event.target.value)}
              fieldClassName="w-[12rem] max-sm:w-full"
            />
          </div>

          <WorkedExample
            samplePaise={samplePaise}
            breakdown={breakdown}
            config={draftConfig}
          />

          <Alert
            tone="info"
            title="Why the two columns differ"
            description="The gateway charges its cut on what it captures, not on what you want to receive, so the extra 2% you added is itself taxed 2% and the shop ends the day a little short on every single sale."
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button size="sm" className="max-sm:h-11" onClick={() => onSave(draftConfig)} disabled={!dirty}>
          Save fee policy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="max-sm:h-11"
          onClick={() => setDraft(toFeeDraft(config))}
          disabled={!dirty}
          leftIcon={<ArrowCounterClockwise size={14} />}
        >
          Discard
        </Button>
        <span className="ml-auto text-[0.75rem] text-text-tertiary">
          Applies to every new bill from the moment it is saved.
        </span>
      </CardFooter>
    </Card>
  );
}

// ─────────────────────────── page ───────────────────────────

export default function SettingsPage() {
  const hydrated = useHydrated();
  const staff = useCurrentStaff();
  const settings = usePharmacyStore((s) => s.settings);
  const feeConfig = usePharmacyStore((s) => s.feeConfig);
  const updateSettings = usePharmacyStore((s) => s.updateSettings);
  const updateFeeConfig = usePharmacyStore((s) => s.updateFeeConfig);

  const isOwner = staff?.role === "OWNER";

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] leading-tight font-light tracking-[-0.02em] text-text">
            Settings
          </h1>
          <p className="mt-1 text-[0.8125rem] text-text-secondary">
            Shop identity and the money policy behind every UPI sale.
          </p>
        </div>
        {staff ? (
          <Badge tone={isOwner ? "brand" : "neutral"} dot>
            {ROLE_LABEL[staff.role]}
            {CAN_EDIT_FEES.includes(staff.role) ? " · can edit fees" : " · read only"}
          </Badge>
        ) : null}
      </header>

      {!hydrated ? (
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <Skeleton className="h-4 w-40" />
            <SkeletonText lines={6} className="mt-4" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-4 w-52" />
            <SkeletonText lines={8} className="mt-4" />
          </Card>
        </div>
      ) : !isOwner ? (
        <Card>
          <EmptyState
            icon={<Lock size={24} />}
            title="Only the owner can change these"
            description="Shop identity, invoice numbering and the payment fee policy decide what every customer is charged and what the shop receives, so they sit behind the owner PIN. Ask the owner to make the change, or hand the till back and sign in as the owner."
            action={
              <Button size="sm" asChild leftIcon={<Storefront size={15} />}>
                <Link href="/pos">Back to the counter</Link>
              </Button>
            }
            footer={
              staff ? <span>Signed in as {staff.name}, {ROLE_LABEL[staff.role]}.</span> : null
            }
          />
        </Card>
      ) : (
        <>
          <ShopDetailsPanel settings={settings} onSave={updateSettings} />
          <FeePolicyPanel config={feeConfig} onSave={updateFeeConfig} />
        </>
      )}
    </div>
  );
}
