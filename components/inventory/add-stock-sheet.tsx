"use client";

/**
 * "Add stock" — one panel, two honest paths.
 *
 * Scanning is the fast path: a code that already belongs to a SKU drops straight
 * into "add a batch to this medicine", and an unknown code opens the new-medicine
 * form with the barcode already filled in, so a scan is never wasted keystrokes.
 * Typing everything by hand is the other path, and it is not hidden behind the
 * scanner for the shops that receive goods away from the counter.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barcode, Keyboard, MagnifyingGlass } from "@phosphor-icons/react";

import {
  Button,
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import { lookupByBarcode } from "@/lib/domain/selectors";
import type { Medicine } from "@/lib/domain/types";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";

import { AddBatchForm } from "./add-batch-form";
import { NewMedicineForm } from "./new-medicine-form";

type Mode = "choose" | "scan" | "new-medicine" | "add-batch";

export interface AddStockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens straight on the new-medicine form with this code prefilled. */
  initialBarcode?: string;
  /** Opens straight on the add-batch form for this SKU. */
  initialMedicineId?: string;
}

const TITLES: Record<Mode, string> = {
  choose: "Add stock",
  scan: "Scan a barcode",
  "new-medicine": "New medicine",
  "add-batch": "Receive a batch",
};

const DESCRIPTIONS: Record<Mode, string> = {
  choose: "Scan a pack, or enter the details by hand.",
  scan: "Point the scanner at the pack. A known code opens its lots straight away.",
  "new-medicine": "The SKU master. Stock and pricing come next, on its first batch.",
  "add-batch": "A lot has its own expiry, MRP, cost and selling price.",
};

export function AddStockSheet({
  open,
  onOpenChange,
  initialBarcode,
  initialMedicineId,
}: AddStockSheetProps) {
  // A session counter, bumped on each open. It keys the flow below, so every
  // opening starts from a clean state without an effect writing state back into
  // render — and, because the key does NOT change on close, the panel keeps its
  // content through the close animation.
  const [wasOpen, setWasOpen] = React.useState(open);
  const [session, setSession] = React.useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((current) => current + 1);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-2xl">
        <AddStockFlow
          key={session}
          onClose={() => onOpenChange(false)}
          initialBarcode={initialBarcode}
          initialMedicineId={initialMedicineId}
        />
      </SheetContent>
    </Sheet>
  );
}

interface AddStockFlowProps {
  onClose: () => void;
  initialBarcode?: string;
  initialMedicineId?: string;
}

function AddStockFlow({ onClose, initialBarcode, initialMedicineId }: AddStockFlowProps) {
  const router = useRouter();
  const medicines = usePharmacyStore((s) => s.medicines);

  const [mode, setMode] = React.useState<Mode>(
    initialMedicineId ? "add-batch" : initialBarcode ? "new-medicine" : "choose",
  );
  const [barcode, setBarcode] = React.useState(initialMedicineId ? "" : (initialBarcode ?? ""));
  const [medicineId, setMedicineId] = React.useState<string | null>(initialMedicineId ?? null);
  const scanFieldRef = React.useRef<HTMLInputElement>(null);

  const medicine = React.useMemo(
    () => medicines.find((m) => m.id === medicineId) ?? null,
    [medicines, medicineId],
  );

  const resolveCode = React.useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const match = lookupByBarcode(code, medicines);
      if (match) {
        setMedicineId(match.id);
        setMode("add-batch");
        toast.success(`${match.name} recognised`, {
          description: "Adding a new lot to the medicine this barcode belongs to.",
        });
        return;
      }
      setBarcode(code);
      setMode("new-medicine");
    },
    [medicines],
  );

  // Hardware scans while this panel is open belong to the panel, not to the page
  // behind it, so the list's own scanner is disabled by the caller.
  useBarcodeScanner({ onScan: resolveCode, enabled: mode === "scan" });

  React.useEffect(() => {
    if (mode === "scan") scanFieldRef.current?.focus();
  }, [mode]);

  function handleCreated(created: Medicine) {
    setMedicineId(created.id);
    setMode("add-batch");
    toast.success(`${created.name} added to the catalogue`, {
      description: "It holds no stock until its first batch is received.",
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{TITLES[mode]}</SheetTitle>
        <SheetDescription>{DESCRIPTIONS[mode]}</SheetDescription>
      </SheetHeader>

      <SheetBody>
        {mode === "choose" ? (
          <div className="flex flex-col gap-3">
            <PathCard
              icon={<Barcode size={20} />}
              title="Scan a barcode"
              description="The fastest path. Known packs jump to their lots, unknown packs start a new medicine with the code already captured."
              onClick={() => setMode("scan")}
            />
            <PathCard
              icon={<Keyboard size={20} />}
              title="Enter manually"
              description="Type the medicine in yourself. For goods received away from the counter, or packs with no readable barcode."
              onClick={() => setMode("new-medicine")}
            />
          </div>
        ) : null}

        {mode === "scan" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              resolveCode(barcode);
            }}
            className="flex flex-col gap-3"
          >
            <Input
              ref={scanFieldRef}
              label="Barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Scan the pack, or type the code"
              leadingIcon={<Barcode size={15} />}
              className="numeric"
              // Opted in, so the global scanner treats a scan here as a scan.
              data-barcode-target=""
              helperText="A hardware scanner works without clicking into this field."
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="max-sm:h-11"
                onClick={() => setMode("choose")}
              >
                Back
              </Button>
              <Button type="submit" className="max-sm:h-11" leftIcon={<MagnifyingGlass size={15} />}>
                Look up
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "new-medicine" ? (
          <NewMedicineForm
            initialBarcode={barcode || undefined}
            onCreated={handleCreated}
            onBack={() => setMode("choose")}
          />
        ) : null}

        {mode === "add-batch" && medicine ? (
          <AddBatchForm
            medicine={medicine}
            onBack={initialMedicineId ? undefined : () => setMode("choose")}
            onSaved={() => {
              onClose();
              router.push(`/inventory/${medicine.id}`);
            }}
          />
        ) : null}

        {mode === "add-batch" && !medicine ? (
          <p className="text-[0.8125rem] text-text-secondary">
            That medicine is no longer in the catalogue. Close this panel and pick it again
            from the list.
          </p>
        ) : null}
      </SheetBody>
    </>
  );
}

function PathCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out-quart)] hover:border-border-strong hover:bg-surface-hover active:scale-[0.995]"
    >
      <span
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-brand-subtle text-brand-text"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.875rem] font-medium text-text">{title}</span>
        <span className="block text-[0.8125rem] leading-relaxed text-text-secondary">
          {description}
        </span>
      </span>
    </button>
  );
}
