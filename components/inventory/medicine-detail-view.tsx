"use client";

/**
 * `/inventory/[medicineId]` — one SKU, all of its lots, and its ledger.
 *
 * The medicine record is only the header here. Everything that matters at a
 * counter (how many, at what price, expiring when) lives on the batches below it,
 * which is why the batch table gets the room and the header gets one dense strip.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ClockCounterClockwise, Package, Plus } from "@phosphor-icons/react";

import { CAN_SEE_COST } from "@/components/app/nav";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  SkeletonRow,
  Stat,
} from "@/components/ui";
import { formatBps, formatPaise } from "@/lib/domain/money";
import {
  batchesFor,
  batchValuePaise,
  isExpired,
  physicalStockFor,
  stockStateOf,
  totalStockFor,
} from "@/lib/domain/selectors";
import type { Batch } from "@/lib/domain/types";
import {
  useCurrentStaff,
  useHydrated,
  usePharmacyStore,
} from "@/lib/store/pharmacy-store";

import { AddStockSheet } from "./add-stock-sheet";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { BatchTable } from "./batch-table";
import { MovementLedger } from "./movement-ledger";
import { pluralUnit, ScheduleBadge, StockBadge, toBadgeTone, useNow } from "./shared";
import { WriteOffDialog } from "./write-off-dialog";

export interface MedicineDetailViewProps {
  medicineId: string;
}

export function MedicineDetailView({ medicineId }: MedicineDetailViewProps) {
  const hydrated = useHydrated();
  const now = useNow();

  const medicines = usePharmacyStore((s) => s.medicines);
  const allBatches = usePharmacyStore((s) => s.batches);
  const allMovements = usePharmacyStore((s) => s.movements);
  const categories = usePharmacyStore((s) => s.categories);
  const suppliers = usePharmacyStore((s) => s.suppliers);
  const staffList = usePharmacyStore((s) => s.staff);
  const bills = usePharmacyStore((s) => s.bills);
  const warningDays = usePharmacyStore((s) => s.settings.expiryWarningDays);

  const staff = useCurrentStaff();
  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [writeOffOpen, setWriteOffOpen] = React.useState(false);
  // The batch is kept after the dialog closes so the panel still has its content
  // to render during the 160ms close animation.
  const [activeBatch, setActiveBatch] = React.useState<Batch | null>(null);

  const medicine = React.useMemo(
    () => medicines.find((m) => m.id === medicineId) ?? null,
    [medicines, medicineId],
  );

  const lots = React.useMemo(
    () => (medicine ? batchesFor(medicine.id, allBatches) : []),
    [medicine, allBatches],
  );

  const movements = React.useMemo(
    () =>
      medicine
        ? allMovements
            .filter((movement) => movement.medicineId === medicine.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [medicine, allMovements],
  );

  const summary = React.useMemo(() => {
    if (!medicine) {
      return { onHand: 0, physical: 0, expiredUnits: 0, expiredLots: 0, valuePaise: 0 };
    }
    let expiredUnits = 0;
    let expiredLots = 0;
    let valuePaise = 0;
    for (const lot of lots) {
      if (isExpired(lot, now)) {
        if (lot.quantity > 0) {
          expiredUnits += lot.quantity;
          expiredLots += 1;
        }
        continue;
      }
      valuePaise += batchValuePaise(lot);
    }
    return {
      onHand: totalStockFor(medicine.id, lots, now),
      physical: physicalStockFor(medicine.id, lots),
      expiredUnits,
      expiredLots,
      valuePaise,
    };
  }, [medicine, lots, now]);

  if (!hydrated) return <DetailSkeleton />;

  if (!medicine) {
    return (
      <div className="mx-auto w-full max-w-[70rem] px-4 py-10 sm:px-6">
        <EmptyState
          icon={<Package size={24} />}
          title="That medicine is not in the catalogue"
          description="It may have been removed, or the link may be out of date. The inventory list has everything that is currently stocked."
          action={
            <Button asChild variant="secondary">
              <Link href="/inventory">Back to inventory</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const category = categories.find((c) => c.id === medicine.categoryId);
  const stockState = stockStateOf(summary.onHand, medicine.reorderLevel);

  function openAdjust(batch: Batch) {
    setActiveBatch(batch);
    setAdjustOpen(true);
  }

  function openWriteOff(batch: Batch) {
    setActiveBatch(batch);
    setWriteOffOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4 px-4 py-5 sm:px-6">
      <Link
        href="/inventory"
        className="inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-text-secondary transition-colors duration-150 ease-[var(--ease-out-quart)] hover:text-text"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Inventory
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-medium tracking-[-0.01em] text-text">
              {medicine.name}
            </h1>
            <ScheduleBadge schedule={medicine.schedule} />
            {medicine.requiresPrescription ? (
              <Badge size="sm" tone="warning">
                Prescription required
              </Badge>
            ) : null}
            <StockBadge state={stockState} />
          </div>
          <p className="text-[0.8125rem] text-text-secondary">
            {medicine.genericName} · {medicine.manufacturer}
          </p>
        </div>

        <Button
          className="max-lg:h-11"
          leftIcon={<Plus size={15} weight="bold" />}
          onClick={() => setSheetOpen(true)}
        >
          Add batch
        </Button>
      </header>

      <Card className="px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.8125rem] sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-6">
          <MetaItem label="Category">
            {category ? (
              <Badge size="sm" tone={toBadgeTone(category.tone)}>
                {category.name}
              </Badge>
            ) : (
              "Uncategorised"
            )}
          </MetaItem>
          <MetaItem label="Rack">
            <span className="numeric">{medicine.rackLocation}</span>
          </MetaItem>
          <MetaItem label="HSN">
            <span className="numeric">{medicine.hsnCode}</span>
          </MetaItem>
          <MetaItem label="GST">
            <span className="numeric">{formatBps(medicine.gstBps)}</span>
            <span className="ml-1 text-xs text-text-tertiary">inclusive</span>
          </MetaItem>
          <MetaItem label="Pack">
            <span className="numeric">{medicine.packSize}</span>
            <span className="ml-1 text-xs text-text-tertiary">per {medicine.unitLabel}</span>
          </MetaItem>
          <MetaItem label="Barcodes">
            <span className="numeric text-xs">
              {medicine.barcodes.length > 0 ? medicine.barcodes.join(", ") : "None recorded"}
            </span>
          </MetaItem>
        </dl>
      </Card>

      <section aria-label="Stock summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="On hand"
          value={summary.onHand}
          unit={pluralUnit(summary.onHand, medicine.unitLabel)}
          hint="Sellable. Expired lots excluded."
        />
        <Stat
          label="Physically on shelf"
          value={summary.physical}
          unit={pluralUnit(summary.physical, medicine.unitLabel)}
          hint="Includes expired lots"
        />
        <Stat
          label="Reorder level"
          value={medicine.reorderLevel}
          unit={pluralUnit(medicine.reorderLevel, medicine.unitLabel)}
          hint="Low stock warns below this"
        />
        {canSeeCost ? (
          <Stat
            label="Value at cost"
            value={formatPaise(summary.valuePaise)}
            hint="Sellable lots only"
          />
        ) : (
          <Stat
            label="Lots on shelf"
            value={lots.filter((lot) => lot.quantity > 0).length}
            hint="Each lot has its own expiry"
          />
        )}
      </section>

      {summary.expiredUnits > 0 ? (
        <Alert
          tone="danger"
          title={`${summary.expiredUnits} ${pluralUnit(summary.expiredUnits, medicine.unitLabel)} past their expiry date`}
          description={`Across ${summary.expiredLots} ${summary.expiredLots === 1 ? "lot" : "lots"}. They are physically on the shelf, are excluded from on-hand stock, and can never be sold. Write them off so the ledger matches the shelf.`}
        />
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
          <h2 className="text-[0.875rem] font-medium text-text">
            Batches
            <span className="numeric ml-2 text-xs font-normal text-text-tertiary">
              {lots.length}
            </span>
          </h2>
          <span className="text-xs text-text-tertiary">
            Sorted FEFO. The earliest expiry sells first.
          </span>
        </div>
        {lots.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Package size={22} />}
            title="No batches yet"
            description="This SKU exists in the catalogue but holds no stock. Receive its first lot to give it an expiry, an MRP and a selling price."
            action={
              <Button
                size="sm"
                leftIcon={<Plus size={14} weight="bold" />}
                onClick={() => setSheetOpen(true)}
              >
                Receive a batch
              </Button>
            }
          />
        ) : (
          <BatchTable
            batches={lots}
            suppliers={suppliers}
            warningDays={warningDays}
            now={now}
            canSeeCost={canSeeCost}
            onAdjust={openAdjust}
            onWriteOff={openWriteOff}
          />
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-[0.875rem] font-medium text-text">
            <ClockCounterClockwise size={15} aria-hidden="true" />
            Movement ledger
            <span className="numeric text-xs font-normal text-text-tertiary">
              {movements.length}
            </span>
          </h2>
          <span className="text-xs text-text-tertiary">Newest first. Append-only.</span>
        </div>
        <MovementLedger
          movements={movements}
          batches={lots}
          staff={staffList}
          bills={bills}
        />
      </Card>

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        batch={activeBatch}
        medicine={medicine}
      />

      <WriteOffDialog
        open={writeOffOpen}
        onOpenChange={setWriteOffOpen}
        batch={activeBatch}
        medicine={medicine}
      />

      <AddStockSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialMedicineId={medicine.id}
      />
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="truncate text-[0.8125rem] text-text">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4 px-4 py-5 sm:px-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-16 rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.5rem] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonRow key={index} widths={[2, 3, 1, 1, 1, 2, 2]} />
        ))}
      </div>
    </div>
  );
}
