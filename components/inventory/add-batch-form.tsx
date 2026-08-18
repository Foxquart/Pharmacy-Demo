"use client";

/**
 * Goods inward. One lot at a time, because a lot is the thing that has a price,
 * a cost and an expiry — the medicine itself has none of those.
 *
 * `addBatch` writes the PURCHASE movement itself, so this form never touches the
 * ledger directly. Money is typed in rupees by the operator and converted once,
 * here, with `rupeesToPaise`. Nothing downstream ever sees a float.
 */

import * as React from "react";
import { toast } from "sonner";

import { CAN_SEE_COST } from "@/components/app/nav";
import {
  Alert,
  Button,
  Field,
  Input,
  NumberInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { formatBps, formatPaise } from "@/lib/domain/money";
import { daysUntil, marginBpsOf } from "@/lib/domain/selectors";
import type { Batch, Medicine, Supplier } from "@/lib/domain/types";
import { useCurrentStaff, usePharmacyStore } from "@/lib/store/pharmacy-store";

import { formatDay, makeLocalId, parseCount, parseRupees, pluralUnit, useNow } from "./shared";

/** Margin preview. Routed through the domain helper rather than re-derived here,
 *  so the live hint and the batch table can never disagree about what margin is. */
function previewMarginBps(costPaise: number, sellingPaise: number): number {
  return marginBpsOf({
    id: "preview",
    medicineId: "preview",
    batchNumber: "",
    expiryDate: "",
    quantity: 0,
    mrpPaise: sellingPaise,
    costPaise,
    sellingPaise,
    receivedAt: "",
  });
}

const NEW_SUPPLIER = "__new_supplier";
const NO_SUPPLIER = "__no_supplier";

interface FormState {
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  mrp: string;
  cost: string;
  selling: string;
  supplierId: string;
  invoiceRef: string;
}

type Errors = Partial<Record<keyof FormState | "expiryAck", string>>;

export interface AddBatchFormProps {
  medicine: Medicine;
  /** Called after the lot is in the store, with the batch that was written. */
  onSaved: (batch: Batch) => void;
  onBack?: () => void;
  backLabel?: string;
}

export function AddBatchForm({ medicine, onSaved, onBack, backLabel = "Back" }: AddBatchFormProps) {
  const now = useNow();
  const suppliers = usePharmacyStore((s) => s.suppliers);
  const addBatch = usePharmacyStore((s) => s.addBatch);
  const upsertSupplier = usePharmacyStore((s) => s.upsertSupplier);
  const staff = useCurrentStaff();
  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  const [form, setForm] = React.useState<FormState>({
    batchNumber: "",
    expiryDate: "",
    quantity: "",
    mrp: "",
    cost: "",
    selling: "",
    supplierId: NO_SUPPLIER,
    invoiceRef: "",
  });
  const [errors, setErrors] = React.useState<Errors>({});
  const [expiryAck, setExpiryAck] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState("");

  function patch(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  const mrpPaise = parseRupees(form.mrp);
  const costPaise = parseRupees(form.cost);
  const sellingPaise = parseRupees(form.selling);

  // Live, so the operator sees the ceiling breach before they reach for Save.
  const overMrp = mrpPaise !== null && sellingPaise !== null && sellingPaise > mrpPaise;
  const daysLeft = form.expiryDate ? daysUntil(form.expiryDate, now) : null;
  const expiryInPast = daysLeft !== null && !Number.isNaN(daysLeft) && daysLeft < 0;
  const marginBps =
    canSeeCost && sellingPaise !== null && costPaise !== null && sellingPaise > 0
      ? previewMarginBps(costPaise, sellingPaise)
      : null;

  function createSupplier() {
    const name = newSupplierName.trim();
    if (!name) return;
    const supplier: Supplier = { id: makeLocalId("sup"), name };
    upsertSupplier(supplier);
    setNewSupplierName("");
    patch({ supplierId: supplier.id });
  }

  function validate(): { batch: Batch } | { errors: Errors } {
    const next: Errors = {};

    if (!form.batchNumber.trim()) next.batchNumber = "Printed on the strip. Required for a recall.";
    if (!form.expiryDate) next.expiryDate = "Required.";

    const quantity = parseCount(form.quantity);
    if (quantity === null || quantity < 1) next.quantity = "At least 1 unit.";

    if (mrpPaise === null || mrpPaise <= 0) next.mrp = "The printed MRP, in rupees.";
    if (costPaise === null) next.cost = "What the shop paid per unit.";
    if (sellingPaise === null || sellingPaise <= 0) next.selling = "The counter price, in rupees.";

    // MRP is a legal ceiling in India: billing above it is an offence, so this is
    // a hard stop rather than a warning.
    if (overMrp && mrpPaise !== null) {
      next.selling = `Cannot exceed the MRP of ${formatPaise(mrpPaise)}. MRP is a legal ceiling in India.`;
    }

    if (expiryInPast && !expiryAck) {
      next.expiryAck = "This lot is already expired. Confirm below before saving it.";
    }

    if (Object.keys(next).length > 0) return { errors: next };

    return {
      batch: {
        id: makeLocalId("bat"),
        medicineId: medicine.id,
        batchNumber: form.batchNumber.trim(),
        expiryDate: form.expiryDate,
        quantity: quantity ?? 0,
        mrpPaise: mrpPaise ?? 0,
        costPaise: costPaise ?? 0,
        sellingPaise: sellingPaise ?? 0,
        supplierId:
          form.supplierId === NO_SUPPLIER || form.supplierId === NEW_SUPPLIER
            ? undefined
            : form.supplierId,
        invoiceRef: form.invoiceRef.trim() || undefined,
        receivedAt: new Date().toISOString(),
      },
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validate();
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    addBatch(result.batch);
    toast.success(`Batch ${result.batch.batchNumber} received`, {
      description: `${result.batch.quantity} ${pluralUnit(result.batch.quantity, medicine.unitLabel)} of ${medicine.name} added, expiring ${formatDay(result.batch.expiryDate)}.`,
    });
    onSaved(result.batch);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-bg-sunken px-3 py-2.5">
        <p className="text-[0.8125rem] font-medium text-text">{medicine.name}</p>
        <p className="text-xs text-text-secondary">
          {medicine.genericName} · {medicine.manufacturer} · rack{" "}
          <span className="numeric">{medicine.rackLocation}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Batch number"
          required
          autoFocus
          value={form.batchNumber}
          onChange={(event) => patch({ batchNumber: event.target.value })}
          errorText={errors.batchNumber}
          className="numeric"
          placeholder="MFG2411A"
        />
        <Input
          label="Expiry date"
          type="date"
          required
          value={form.expiryDate}
          onChange={(event) => patch({ expiryDate: event.target.value })}
          errorText={errors.expiryDate}
          className="numeric"
          hint={
            daysLeft !== null && !Number.isNaN(daysLeft) && !expiryInPast
              ? `${daysLeft} days left`
              : undefined
          }
        />
      </div>

      {expiryInPast ? (
        <Alert
          tone="danger"
          title="This lot has already expired"
          description={`${formatDay(form.expiryDate)} is in the past. Expired stock is never sellable, is excluded from on-hand totals, and can only be written off.`}
        >
          <label className="mt-1 flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
              checked={expiryAck}
              onChange={(event) => setExpiryAck(event.target.checked)}
            />
            <span className="text-[0.8125rem] leading-snug">
              I am recording an already-expired lot on purpose.
            </span>
          </label>
          {errors.expiryAck ? (
            <p className="pt-1 text-xs font-medium">{errors.expiryAck}</p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberInput
          label="Quantity"
          required
          hint={medicine.unitLabel}
          value={form.quantity}
          onChange={(event) => patch({ quantity: event.target.value })}
          errorText={errors.quantity}
        />
        <NumberInput
          label="MRP"
          required
          hint="₹ per unit"
          value={form.mrp}
          onChange={(event) => patch({ mrp: event.target.value })}
          errorText={errors.mrp}
        />
        <NumberInput
          label="Cost"
          required
          hint="₹ per unit"
          value={form.cost}
          onChange={(event) => patch({ cost: event.target.value })}
          errorText={errors.cost}
        />
        <NumberInput
          label="Selling price"
          required
          hint="₹ per unit"
          value={form.selling}
          onChange={(event) => patch({ selling: event.target.value })}
          errorText={errors.selling}
          error={overMrp}
          helperText={
            !overMrp && marginBps !== null ? `Margin ${formatBps(marginBps)}` : undefined
          }
        />
      </div>

      {overMrp && mrpPaise !== null && sellingPaise !== null ? (
        <Alert
          tone="danger"
          title="Selling price is above the MRP"
          description={`${formatPaise(sellingPaise)} exceeds the printed ceiling of ${formatPaise(mrpPaise)}. Indian retail MRP is the maximum a customer may legally be charged, so this lot cannot be saved until the price comes down.`}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field label="Supplier" htmlFor="add-batch-supplier">
            <Select
              value={form.supplierId}
              onValueChange={(value) => patch({ supplierId: value })}
            >
              <SelectTrigger id="add-batch-supplier" aria-label="Supplier">
                <SelectValue placeholder="Pick a supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPLIER}>No supplier recorded</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SUPPLIER}>Add a new supplier</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.supplierId === NEW_SUPPLIER ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                size="sm"
                label="Supplier name"
                value={newSupplierName}
                onChange={(event) => setNewSupplierName(event.target.value)}
                placeholder="Aditya Pharma Distributors"
              />
              <Button
                size="sm"
                variant="secondary"
                className="max-sm:h-11 max-sm:w-full"
                onClick={createSupplier}
              >
                Create
              </Button>
            </div>
          ) : null}
        </div>

        <Input
          label="Invoice reference"
          value={form.invoiceRef}
          onChange={(event) => patch({ invoiceRef: event.target.value })}
          helperText="Written into the purchase movement, so the ledger points back at the paperwork."
          className="numeric"
          placeholder="ADP/24-25/1180"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {onBack ? (
          <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onBack}>
            {backLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" className="max-sm:h-11" disabled={overMrp}>
          Receive batch
        </Button>
      </div>
    </form>
  );
}
