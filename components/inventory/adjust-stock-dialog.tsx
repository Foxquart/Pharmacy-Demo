"use client";

/**
 * Manual stock adjustment.
 *
 * The reason is mandatory and is what makes this screen worth having: an
 * unexplained correction is indistinguishable from theft six weeks later, when
 * somebody is reading the ledger and trying to work out where forty strips went.
 * Common reasons are offered as a list so the ledger stays greppable, with free
 * text for the cases that are genuinely one-off.
 */

import * as React from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  NumberInput,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { Batch, Medicine } from "@/lib/domain/types";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";

import { formatDay, parseCount, pluralUnit } from "./shared";

type Direction = "REMOVE" | "ADD";

const REASONS = [
  { value: "Damaged", label: "Damaged" },
  { value: "Stock count correction", label: "Stock count correction" },
  { value: "Expired", label: "Expired" },
  { value: "Returned to supplier", label: "Returned to supplier" },
  { value: "OTHER", label: "Other (write it out)" },
];

export interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  medicine: Medicine;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  batch,
  medicine,
}: AdjustStockDialogProps) {
  // Every opening is a fresh adjustment. A session counter keys the panel below,
  // so the form remounts clean on open without an effect writing state during
  // render, and keeps its content through the close animation.
  const [wasOpen, setWasOpen] = React.useState(open);
  const [session, setSession] = React.useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((current) => current + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <AdjustStockPanel
          key={session}
          batch={batch}
          medicine={medicine}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AdjustStockPanelProps {
  batch: Batch | null;
  medicine: Medicine;
  onClose: () => void;
}

function AdjustStockPanel({ batch, medicine, onClose }: AdjustStockPanelProps) {
  const adjustStock = usePharmacyStore((s) => s.adjustStock);

  const [direction, setDirection] = React.useState<Direction>("REMOVE");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState(REASONS[0].value);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const parsed = parseCount(quantity);
  const onHand = batch?.quantity ?? 0;

  function submit() {
    if (!batch) return;
    if (parsed === null || parsed < 1) {
      setError("Enter how many units are being added or removed.");
      return;
    }
    if (direction === "REMOVE" && parsed > onHand) {
      setError(`Only ${onHand} ${pluralUnit(onHand, medicine.unitLabel)} on hand in this lot.`);
      return;
    }
    const trimmedNote = note.trim();
    if (reason === "OTHER" && !trimmedNote) {
      setError("Write the reason out. The ledger has to say what happened.");
      return;
    }

    const reasonText =
      reason === "OTHER" ? trimmedNote : trimmedNote ? `${reason}: ${trimmedNote}` : reason;

    const delta = direction === "REMOVE" ? -parsed : parsed;
    const ok = adjustStock(batch.id, delta, reasonText);
    if (!ok) {
      setError("Nothing changed. Check the quantity and try again.");
      return;
    }

    toast.success(`Batch ${batch.batchNumber} adjusted`, {
      description: `${delta > 0 ? "+" : ""}${delta} ${pluralUnit(Math.abs(delta), medicine.unitLabel)} · ${reasonText}`,
    });
    onClose();
  }

  const nextBalance =
    parsed === null ? onHand : direction === "REMOVE" ? Math.max(0, onHand - parsed) : onHand + parsed;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          {batch
            ? `Batch ${batch.batchNumber} of ${medicine.name}, expiring ${formatDay(batch.expiryDate)}.`
            : null}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Direction">
            <Segmented
              aria-label="Add or remove units"
              value={direction}
              onValueChange={(value: Direction) => setDirection(value)}
              options={[
                { value: "REMOVE", label: "Remove" },
                { value: "ADD", label: "Add" },
              ]}
            />
          </Field>
          <NumberInput
            label="Units"
            hint={medicine.unitLabel}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            fieldClassName="w-32 max-sm:w-full"
            autoFocus
          />
          <p className="pb-2 text-[0.8125rem] text-text-secondary">
            <span className="numeric">{onHand}</span> on hand now,{" "}
            <span className="numeric font-medium text-text">{nextBalance}</span> after this
            adjustment.
          </p>
        </div>

        <Field label="Reason" htmlFor="adjust-reason" required>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="adjust-reason" aria-label="Reason for the adjustment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Input
          label={reason === "OTHER" ? "What happened" : "Note"}
          required={reason === "OTHER"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            reason === "OTHER"
              ? "Two strips crushed under a carton in the back room"
              : "Optional detail, kept on the ledger entry"
          }
        />

        {error ? (
          <p role="alert" className="text-xs leading-snug font-medium text-danger-text">
            {error}
          </p>
        ) : null}
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!batch}>
          Record adjustment
        </Button>
      </DialogFooter>
    </>
  );
}
