"use client";

/**
 * The new-SKU form.
 *
 * Two rules here are not cosmetic:
 *  • A barcode may only ever point at ONE medicine. If a code is already on
 *    another pack, the scan at the counter would pick the wrong drug, so the
 *    form refuses to save and names the SKU it clashes with.
 *  • Schedule drives `requiresPrescription`. Picking Schedule H, H1 or X ticks it
 *    and locks it, because the prescription gate at the counter reads that flag
 *    and the two must never drift apart.
 */

import * as React from "react";

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
import { scheduleLabel } from "@/lib/domain/selectors";
import type { Category, DrugSchedule, Medicine } from "@/lib/domain/types";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";

import { makeLocalId, parseCount, slugify } from "./shared";

const NEW_CATEGORY = "__new_category";

const SCHEDULES: DrugSchedule[] = [
  "OTC",
  "SCHEDULE_H",
  "SCHEDULE_H1",
  "SCHEDULE_X",
  "SCHEDULE_G",
  "AYURVEDIC",
];

/** Schedules where a prescription is a legal requirement, not a preference. */
const PRESCRIPTION_SCHEDULES = new Set<DrugSchedule>([
  "SCHEDULE_H",
  "SCHEDULE_H1",
  "SCHEDULE_X",
]);

const GST_OPTIONS = [
  { value: "0", label: "0% (exempt)" },
  { value: "500", label: "5%" },
  { value: "1200", label: "12%" },
  { value: "1800", label: "18%" },
];

interface FormState {
  name: string;
  genericName: string;
  manufacturer: string;
  categoryId: string;
  schedule: DrugSchedule;
  requiresPrescription: boolean;
  hsnCode: string;
  gstBps: string;
  unitLabel: string;
  packSize: string;
  reorderLevel: string;
  rackLocation: string;
  barcodes: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

export interface NewMedicineFormProps {
  initialBarcode?: string;
  /** Handed the saved SKU so the caller can move straight on to its first batch. */
  onCreated: (medicine: Medicine) => void;
  onBack: () => void;
}

export function NewMedicineForm({ initialBarcode, onCreated, onBack }: NewMedicineFormProps) {
  const categories = usePharmacyStore((s) => s.categories);
  const medicines = usePharmacyStore((s) => s.medicines);
  const upsertMedicine = usePharmacyStore((s) => s.upsertMedicine);
  const upsertCategory = usePharmacyStore((s) => s.upsertCategory);

  const sortedCategories = React.useMemo(
    () => categories.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const [form, setForm] = React.useState<FormState>({
    name: "",
    genericName: "",
    manufacturer: "",
    categoryId: sortedCategories[0]?.id ?? "",
    schedule: "OTC",
    requiresPrescription: false,
    hsnCode: "3004",
    gstBps: "1200",
    unitLabel: "strip",
    packSize: "10",
    reorderLevel: "24",
    rackLocation: "",
    barcodes: initialBarcode ?? "",
  });
  const [errors, setErrors] = React.useState<Errors>({});
  const [newCategoryName, setNewCategoryName] = React.useState("");

  const prescriptionLocked = PRESCRIPTION_SCHEDULES.has(form.schedule);

  function patch(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function handleSchedule(schedule: DrugSchedule) {
    const locked = PRESCRIPTION_SCHEDULES.has(schedule);
    patch({
      schedule,
      // Ticked automatically for H/H1/X. Moving back to an OTC schedule clears
      // the auto-tick rather than leaving a stale legal claim on the SKU.
      requiresPrescription: locked ? true : prescriptionLocked ? false : form.requiresPrescription,
    });
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const category: Category = {
      id: makeLocalId("cat"),
      name,
      slug: slugify(name) || makeLocalId("cat"),
      tone: "neutral",
      sortOrder: categories.length + 1,
    };
    upsertCategory(category);
    setNewCategoryName("");
    patch({ categoryId: category.id });
  }

  function parseBarcodes(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(/[\s,]+/)
          .map((code) => code.trim())
          .filter(Boolean),
      ),
    );
  }

  function validate(): { medicine: Medicine } | { errors: Errors } {
    const next: Errors = {};

    if (!form.name.trim()) next.name = "The brand name printed on the pack.";
    if (!form.genericName.trim()) next.genericName = "The salt is what a pharmacist substitutes on.";
    if (!form.manufacturer.trim()) next.manufacturer = "Required.";
    if (!form.categoryId || form.categoryId === NEW_CATEGORY) {
      next.categoryId = "Pick a category, or create one.";
    }
    if (!form.hsnCode.trim()) next.hsnCode = "Required on a GST invoice.";
    if (!form.unitLabel.trim()) next.unitLabel = "Strip, bottle, tube, vial.";

    const packSize = parseCount(form.packSize);
    if (packSize === null || packSize < 1) next.packSize = "At least 1 unit per pack.";

    const reorderLevel = parseCount(form.reorderLevel);
    if (reorderLevel === null) next.reorderLevel = "A whole number of units, or 0.";

    const barcodes = parseBarcodes(form.barcodes);
    // One code, one SKU. A duplicate would make the counter scan the wrong drug.
    for (const code of barcodes) {
      const clash = medicines.find((m) => m.barcodes.includes(code));
      if (clash) {
        next.barcodes = `${code} is already on ${clash.name}. One barcode can only point at one medicine.`;
        break;
      }
    }

    if (Object.keys(next).length > 0) return { errors: next };

    return {
      medicine: {
        id: makeLocalId("med"),
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        manufacturer: form.manufacturer.trim(),
        categoryId: form.categoryId,
        schedule: form.schedule,
        requiresPrescription: prescriptionLocked || form.requiresPrescription,
        hsnCode: form.hsnCode.trim(),
        gstBps: Number(form.gstBps),
        unitLabel: form.unitLabel.trim(),
        packSize: packSize ?? 1,
        reorderLevel: reorderLevel ?? 0,
        rackLocation: form.rackLocation.trim() || "Unassigned",
        barcodes,
        isActive: true,
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
    upsertMedicine(result.medicine);
    onCreated(result.medicine);
  }

  return (
    <form id="new-medicine-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {initialBarcode ? (
        <Alert
          tone="info"
          title="Barcode captured"
          description={`${initialBarcode} will be saved against this medicine, so the next scan finds it.`}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Brand name"
          required
          autoFocus
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          errorText={errors.name}
          placeholder="Dolo 650"
        />
        <Input
          label="Generic name"
          required
          value={form.genericName}
          onChange={(event) => patch({ genericName: event.target.value })}
          errorText={errors.genericName}
          placeholder="Paracetamol 650mg"
        />
        <Input
          label="Manufacturer"
          required
          value={form.manufacturer}
          onChange={(event) => patch({ manufacturer: event.target.value })}
          errorText={errors.manufacturer}
          placeholder="Micro Labs"
          fieldClassName="sm:col-span-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field label="Category" htmlFor="new-medicine-category" errorText={errors.categoryId}>
            <Select
              value={form.categoryId}
              onValueChange={(value) => patch({ categoryId: value })}
            >
              <SelectTrigger
                id="new-medicine-category"
                aria-label="Category"
                error={Boolean(errors.categoryId)}
              >
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {sortedCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY}>Create a new category</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.categoryId === NEW_CATEGORY ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                size="sm"
                label="New category name"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Ophthalmics"
              />
              <Button
                size="sm"
                variant="secondary"
                className="max-sm:h-11 max-sm:w-full"
                onClick={createCategory}
              >
                Create
              </Button>
            </div>
          ) : null}
        </div>

        <Field label="Schedule" htmlFor="new-medicine-schedule">
          <Select value={form.schedule} onValueChange={(value) => handleSchedule(value as DrugSchedule)}>
            <SelectTrigger id="new-medicine-schedule" aria-label="Drug schedule">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULES.map((schedule) => (
                <SelectItem key={schedule} value={schedule}>
                  {scheduleLabel(schedule)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-sunken p-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
          checked={prescriptionLocked || form.requiresPrescription}
          disabled={prescriptionLocked}
          onChange={(event) => patch({ requiresPrescription: event.target.checked })}
        />
        <span className="text-[0.8125rem] leading-snug text-text">
          Prescription required
          <span className="block text-xs text-text-secondary">
            {prescriptionLocked
              ? `${scheduleLabel(form.schedule)} cannot be sold without a prescription, so this stays ticked.`
              : "The counter blocks the sale until a prescription reference is entered."}
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="HSN code"
          required
          value={form.hsnCode}
          onChange={(event) => patch({ hsnCode: event.target.value })}
          errorText={errors.hsnCode}
          className="numeric"
        />
        <Field label="GST rate" htmlFor="new-medicine-gst">
          <Select value={form.gstBps} onValueChange={(value) => patch({ gstBps: value })}>
            <SelectTrigger id="new-medicine-gst" aria-label="GST rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GST_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Unit label"
          required
          value={form.unitLabel}
          onChange={(event) => patch({ unitLabel: event.target.value })}
          errorText={errors.unitLabel}
          placeholder="strip"
        />
        <NumberInput
          label="Pack size"
          hint="per unit"
          value={form.packSize}
          onChange={(event) => patch({ packSize: event.target.value })}
          errorText={errors.packSize}
        />
        <NumberInput
          label="Reorder level"
          hint="units"
          value={form.reorderLevel}
          onChange={(event) => patch({ reorderLevel: event.target.value })}
          errorText={errors.reorderLevel}
          helperText="Low stock warns here."
        />
        <Input
          label="Rack location"
          value={form.rackLocation}
          onChange={(event) => patch({ rackLocation: event.target.value })}
          placeholder="A-04"
          className="numeric"
        />
      </div>

      <Input
        label="Barcodes"
        value={form.barcodes}
        onChange={(event) => patch({ barcodes: event.target.value })}
        errorText={errors.barcodes}
        helperText="Separate several codes with a comma. A SKU can carry one per pack size."
        className="numeric"
        placeholder="8901234567890"
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="max-sm:h-11">
          Save and add a batch
        </Button>
      </div>
    </form>
  );
}
