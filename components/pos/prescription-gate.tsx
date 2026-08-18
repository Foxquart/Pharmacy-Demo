"use client";

import * as React from "react";
import { Prescription, ShieldCheck } from "@phosphor-icons/react";

import { Alert, Badge, Input } from "@/components/ui";
import { scheduleLabel, scheduleTone } from "@/lib/domain/selectors";
import type { Medicine } from "@/lib/domain/types";

import { toBadgeTone } from "./expiry-badge";

export interface PrescriptionGateProps {
  /** De-duplicated list of cart medicines that carry a prescription obligation. */
  medicines: Medicine[];
  prescriptionRef: string;
  doctorName: string;
  onChange: (patch: { prescriptionRef?: string; doctorName?: string }) => void;
}

/**
 * Schedule H, H1 and X are not a nag. Dispensing them without recording the
 * prescription is an offence under the Drugs and Cosmetics Rules, and for H1 the
 * entry has to survive in a bound register for three years. So the gate states
 * exactly which items triggered it, takes the reference in one field, and then
 * gets out of the way rather than staying red for the rest of the sale.
 */
export function PrescriptionGate({
  medicines,
  prescriptionRef,
  doctorName,
  onChange,
}: PrescriptionGateProps) {
  const refId = React.useId();
  const doctorId = React.useId();
  const satisfied = prescriptionRef.trim().length > 0;

  if (medicines.length === 0) return null;

  return (
    <Alert
      tone={satisfied ? "success" : "warning"}
      icon={
        satisfied ? (
          <ShieldCheck size={17} weight="fill" />
        ) : (
          <Prescription size={17} weight="fill" />
        )
      }
      title={
        satisfied
          ? "Prescription recorded against this sale"
          : "This sale needs a prescription reference before it can be billed"
      }
      description={
        satisfied
          ? "It is stamped onto the invoice and stays with the bill in Payments."
          : "The items below are restricted. Enter the prescription reference the customer presented."
      }
    >
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {medicines.map((medicine) => (
          <li key={medicine.id}>
            <Badge tone={toBadgeTone(scheduleTone(medicine.schedule))} size="sm">
              {medicine.name} · {scheduleLabel(medicine.schedule)}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input
          id={refId}
          size="sm"
          label="Prescription reference"
          required
          placeholder="RX-2026-0148"
          value={prescriptionRef}
          autoComplete="off"
          onChange={(event) => onChange({ prescriptionRef: event.target.value })}
        />
        <Input
          id={doctorId}
          size="sm"
          label="Prescribing doctor"
          hint="optional"
          placeholder="Dr. A. Menon"
          value={doctorName}
          autoComplete="off"
          onChange={(event) => onChange({ doctorName: event.target.value })}
        />
      </div>
    </Alert>
  );
}
