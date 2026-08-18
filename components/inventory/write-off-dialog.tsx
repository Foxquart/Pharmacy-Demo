"use client";

/**
 * Expiry write-off.
 *
 * `writeOffExpired` zeroes the lot and appends an EXPIRY_WRITE_OFF movement, so
 * the units leave the shelf but stay in the ledger forever. The confirmation
 * states the exact unit count and the money it represents, because "are you
 * sure?" with no number attached is the dialog everybody clicks through.
 */

import * as React from "react";
import { toast } from "sonner";

import { CAN_SEE_COST } from "@/components/app/nav";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { formatPaise } from "@/lib/domain/money";
import { batchValuePaise } from "@/lib/domain/selectors";
import type { Batch, Medicine } from "@/lib/domain/types";
import { useCurrentStaff, usePharmacyStore } from "@/lib/store/pharmacy-store";

import { formatDay, pluralUnit } from "./shared";

export interface WriteOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  medicine: Medicine;
}

export function WriteOffDialog({ open, onOpenChange, batch, medicine }: WriteOffDialogProps) {
  const writeOffExpired = usePharmacyStore((s) => s.writeOffExpired);
  const staff = useCurrentStaff();
  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  function confirm() {
    if (!batch) return;
    const units = batch.quantity;
    const ok = writeOffExpired(batch.id);
    if (!ok) {
      toast.error("Nothing to write off", {
        description: "This lot is already at zero.",
      });
      onOpenChange(false);
      return;
    }
    toast.success(`Batch ${batch.batchNumber} written off`, {
      description: `${units} ${pluralUnit(units, medicine.unitLabel)} removed from the shelf and recorded in the ledger.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Write off expired stock</DialogTitle>
          <DialogDescription>
            {batch
              ? `Batch ${batch.batchNumber} of ${medicine.name}, expired ${formatDay(batch.expiryDate)}.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {batch ? (
            <>
              <Alert
                tone="danger"
                title={`${batch.quantity} ${pluralUnit(batch.quantity, medicine.unitLabel)} will be written off`}
                description="The batch quantity goes to zero and an EXPIRY_WRITE_OFF movement is appended to the ledger. This cannot be undone."
              />
              <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]">
                <div>
                  <dt className="text-text-tertiary">Units on the shelf</dt>
                  <dd className="numeric font-medium text-text">{batch.quantity}</dd>
                </div>
                <div>
                  <dt className="text-text-tertiary">Expired on</dt>
                  <dd className="numeric font-medium text-text">{formatDay(batch.expiryDate)}</dd>
                </div>
                {canSeeCost ? (
                  <div>
                    <dt className="text-text-tertiary">Value at cost</dt>
                    <dd className="numeric font-medium text-danger-text">
                      {formatPaise(batchValuePaise(batch))}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-text-tertiary">Batch</dt>
                  <dd className="numeric font-medium text-text">{batch.batchNumber}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep the batch
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!batch || batch.quantity <= 0}>
            Write off {batch ? `${batch.quantity} ${pluralUnit(batch.quantity, medicine.unitLabel)}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
