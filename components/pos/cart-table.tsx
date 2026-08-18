"use client";

import * as React from "react";
import { Barcode, Minus, Plus, Trash } from "@phosphor-icons/react";

import {
  Button,
  EmptyState,
  Kbd,
  KbdGroup,
  NumberInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatBps, formatPaise, formatPaiseTight, paiseToRupees, rupeesToPaise } from "@/lib/domain/money";
import {
  computeLineTotals,
  expiryStateOf,
  fefoBatch,
  marginBpsOf,
  sellableBatches,
} from "@/lib/domain/selectors";
import type { Batch, CartLine, Medicine } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { ExpiryBadge, ScheduleBadge, formatExpiry, formatExpiryShort } from "./expiry-badge";

export interface CartTableProps {
  cart: CartLine[];
  medicines: Medicine[];
  batches: Batch[];
  now: Date;
  warningDays: number;
  activeLineId: string | null;
  /** OWNER / PHARMACIST only. A cashier must never see cost or margin. */
  canSeeCost: boolean;
  onActivate: (lineId: string) => void;
  onQty: (lineId: string, quantity: number) => void;
  onBatch: (lineId: string, batchId: string) => void;
  onDiscount: (lineId: string, paise: number) => void;
  onRemove: (lineId: string) => void;
  onFocusSearch: () => void;
}

function discountToDraft(paise: number): string {
  return paise > 0 ? String(paiseToRupees(paise)) : "";
}

/** Rows are focusable, so the whole cart is reachable with the arrow keys and
 *  the operator never has to reach for the mouse mid-queue.
 *
 *  Below `md` the cart renders as stacked cards and above it as a table, so both
 *  carry the marker and only the one currently laid out is focused. A hidden
 *  element has no `offsetParent`, which is the cheapest reliable test for that. */
export function focusCartLine(lineId: string) {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-cart-line="${lineId}"]`);
  for (const candidate of candidates) {
    if (candidate.offsetParent !== null) {
      candidate.focus();
      return;
    }
  }
  candidates[0]?.focus();
}

export function CartTable({
  cart,
  medicines,
  batches,
  now,
  warningDays,
  activeLineId,
  canSeeCost,
  onActivate,
  onQty,
  onBatch,
  onDiscount,
  onRemove,
  onFocusSearch,
}: CartTableProps) {
  const medicineById = React.useMemo(
    () => new Map(medicines.map((medicine) => [medicine.id, medicine])),
    [medicines],
  );
  const batchById = React.useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch])),
    [batches],
  );

  if (cart.length === 0) {
    return (
      <EmptyState
        icon={<Barcode size={24} aria-hidden="true" />}
        title="Nothing on the counter yet"
        description="Scan a pack or start typing a brand or a salt. The oldest sellable batch is picked for you, and expired stock can never be added."
        footer={
          // The key hints are noise on a phone, where none of these keys exist.
          <span className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-1.5 lg:flex">
            <span className="flex items-center gap-1.5">
              <Kbd size="sm">F2</Kbd> search
            </span>
            <span className="flex items-center gap-1.5">
              <KbdGroup separator="/">
                <Kbd size="sm">↑</Kbd>
                <Kbd size="sm">↓</Kbd>
              </KbdGroup>
              move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd size="sm">Enter</Kbd> add
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd size="sm">F4</Kbd> cash
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd size="sm">F8</Kbd> UPI
            </span>
          </span>
        }
      />
    );
  }

  const lines = cart
    .map((line, index) => {
      const medicine = medicineById.get(line.medicineId);
      const batch = batchById.get(line.batchId);
      if (!medicine || !batch) return null;
      return { line, medicine, batch, index };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  function neighbours(index: number) {
    return {
      onPrev: () => {
        const previous = cart[index - 1];
        if (previous) focusCartLine(previous.id);
        else onFocusSearch();
      },
      onNext: () => {
        const next = cart[index + 1];
        if (next) focusCartLine(next.id);
      },
    };
  }

  const shared = {
    batches,
    now,
    warningDays,
    canSeeCost,
    onActivate,
    onQty,
    onBatch,
    onDiscount,
    onRemove,
  };

  return (
    <>
      {/* Phones and small tablets: one card per line. A cart that scrolls
          sideways is unusable at a counter, so the row is unwound into a stack
          rather than squeezed into six columns. */}
      <ul className="divide-y divide-border md:hidden">
        {lines.map(({ line, medicine, batch, index }) => (
          <CartCard
            key={line.id}
            line={line}
            medicine={medicine}
            batch={batch}
            active={activeLineId === line.id}
            {...shared}
            {...neighbours(index)}
          />
        ))}
      </ul>

      <div className="hidden md:block">
        <Table containerClassName="rounded-[var(--radius-lg)]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[9.5rem] px-2">Item</TableHead>
              <TableHead className="min-w-[9.5rem] px-2">Batch and expiry</TableHead>
              <TableHead numeric className="min-w-[6rem] px-2">
                Qty
              </TableHead>
              <TableHead numeric className="min-w-[4.75rem] px-2">
                Disc / unit
              </TableHead>
              <TableHead numeric className="min-w-[5.5rem] px-2">
                Line total
              </TableHead>
              <TableHead className="w-8 px-1">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {lines.map(({ line, medicine, batch, index }) => (
              <CartRow
                key={line.id}
                line={line}
                medicine={medicine}
                batch={batch}
                active={activeLineId === line.id}
                {...shared}
                {...neighbours(index)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

interface CartLineProps {
  line: CartLine;
  medicine: Medicine;
  batch: Batch;
  batches: Batch[];
  now: Date;
  warningDays: number;
  active: boolean;
  canSeeCost: boolean;
  onActivate: (lineId: string) => void;
  onQty: (lineId: string, quantity: number) => void;
  onBatch: (lineId: string, batchId: string) => void;
  onDiscount: (lineId: string, paise: number) => void;
  onRemove: (lineId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Everything both layouts need: the line's money, the lots it may move to, and
 * the discount draft the operator is part-way through typing. Held once so the
 * card and the row can never disagree about what a line is worth.
 */
function useCartLine({
  line,
  medicine,
  batch,
  batches,
  now,
  onDiscount,
}: Pick<CartLineProps, "line" | "medicine" | "batch" | "batches" | "now" | "onDiscount">) {
  // Every money figure on this line comes back from the selector. Nothing here
  // multiplies or subtracts rupees itself.
  const totals = computeLineTotals(line, medicine, batch);

  const options = React.useMemo(() => {
    const sellable = sellableBatches(medicine.id, batches, now);
    // Keep the lot currently on the line visible even if it has just gone to
    // zero on hand, otherwise the select would render with no matching value.
    return sellable.some((candidate) => candidate.id === batch.id)
      ? sellable
      : [batch, ...sellable];
  }, [medicine.id, batches, now, batch]);

  const fefoId = React.useMemo(
    () => fefoBatch(medicine.id, batches, now)?.id ?? null,
    [medicine.id, batches, now],
  );

  const [discountDraft, setDiscountDraft] = React.useState(() =>
    discountToDraft(line.discountPaise),
  );
  // The box is a draft the operator is mid-way through typing, so it is only
  // re-seeded when the committed value actually changes underneath it. Adjusting
  // during render rather than in an effect keeps the field from flashing the old
  // number for a frame after a batch swap clamps the discount.
  const [committedDiscount, setCommittedDiscount] = React.useState(line.discountPaise);
  if (committedDiscount !== line.discountPaise) {
    setCommittedDiscount(line.discountPaise);
    setDiscountDraft(discountToDraft(line.discountPaise));
  }

  const commitDiscount = React.useCallback(() => {
    const parsed = Number(discountDraft.trim());
    onDiscount(line.id, Number.isFinite(parsed) && parsed > 0 ? rupeesToPaise(parsed) : 0);
  }, [discountDraft, onDiscount, line.id]);

  return { totals, options, fefoId, discountDraft, setDiscountDraft, commitDiscount };
}

function BatchSelect({
  medicine,
  batch,
  options,
  fefoId,
  now,
  warningDays,
  className,
  size = "sm",
  onActivate,
  onBatch,
  lineId,
}: {
  medicine: Medicine;
  batch: Batch;
  options: Batch[];
  fefoId: string | null;
  now: Date;
  warningDays: number;
  className?: string;
  size?: "sm" | "md";
  onActivate: (lineId: string) => void;
  onBatch: (lineId: string, batchId: string) => void;
  lineId: string;
}) {
  return (
    <Select
      value={batch.id}
      onValueChange={(next) => {
        onActivate(lineId);
        onBatch(lineId, next);
      }}
    >
      <SelectTrigger size={size} aria-label={`Batch for ${medicine.name}`} className={className}>
        {/* The trigger carries the batch number alone. The full expiry sits
            directly under it, and the dropdown itself spells out every lot
            with its date, so the closed control does not need to. */}
        <SelectValue>
          <span className="numeric">{batch.batchNumber}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const state = expiryStateOf(option.expiryDate, now, warningDays);
          return (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex items-center gap-2">
                <span className="numeric">{option.batchNumber}</span>
                <span
                  className={cn(
                    "text-[0.6875rem]",
                    state === "EXPIRED" || state === "CRITICAL"
                      ? "text-danger-text"
                      : state === "WARNING"
                        ? "text-warning-text"
                        : "text-text-tertiary",
                  )}
                >
                  {formatExpiryShort(option.expiryDate)}
                </span>
                {option.id === fefoId ? (
                  <span className="text-[0.6875rem] text-brand-text">FEFO</span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Shared arrow / quantity / delete handling. Both layouts are focusable, so
 *  the cart stays fully keyboard reachable on a tablet with a keyboard too. */
function useLineKeys({
  line,
  onQty,
  onRemove,
  onPrev,
  onNext,
}: Pick<CartLineProps, "line" | "onQty" | "onRemove" | "onPrev" | "onNext">) {
  return function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    // Inside the discount box the same keys mean digits, so the line steps aside.
    if (target.tagName === "INPUT") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onNext();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onPrev();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      onQty(line.id, line.quantity + 1);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      onQty(line.id, line.quantity - 1);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      onRemove(line.id);
    }
  };
}

// ─────────────────────────── card (below md) ───────────────────────────

function CartCard(props: CartLineProps) {
  const {
    line,
    medicine,
    batch,
    now,
    warningDays,
    active,
    canSeeCost,
    onActivate,
    onQty,
    onBatch,
    onRemove,
  } = props;
  const { totals, options, fefoId, discountDraft, setDiscountDraft, commitDiscount } =
    useCartLine(props);
  const handleKeyDown = useLineKeys(props);

  return (
    <li
      data-cart-line={line.id}
      tabIndex={0}
      onFocus={() => onActivate(line.id)}
      onClick={() => onActivate(line.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-col gap-2.5 px-3 py-3",
        "transition-colors duration-150 ease-[var(--ease-out-quart)]",
        active && "bg-brand-subtle",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[0.9375rem] font-medium text-text">{medicine.name}</span>
            <ScheduleBadge schedule={medicine.schedule} />
          </div>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-text-secondary">
            {medicine.genericName}
          </p>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="-mt-1 -mr-1 size-11 shrink-0"
          aria-label={`Remove ${medicine.name} from the cart`}
          onClick={() => onRemove(line.id)}
        >
          <Trash size={17} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <BatchSelect
          lineId={line.id}
          medicine={medicine}
          batch={batch}
          options={options}
          fefoId={fefoId}
          now={now}
          warningDays={warningDays}
          size="md"
          className="w-[8.5rem]"
          onActivate={onActivate}
          onBatch={onBatch}
        />
        <span className="numeric text-[0.75rem] text-text-secondary">
          exp {formatExpiry(batch.expiryDate)}
        </span>
        <ExpiryBadge expiryDate={batch.expiryDate} now={now} warningDays={warningDays} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="size-11"
            aria-label={`Reduce ${medicine.name} by one`}
            onClick={() => onQty(line.id, line.quantity - 1)}
          >
            <Minus size={15} weight="bold" />
          </Button>
          <span className="numeric w-11 text-center text-[1rem] font-medium text-text">
            {line.quantity}
          </span>
          <Button
            size="icon"
            variant="secondary"
            className="size-11"
            aria-label={`Add one more ${medicine.name}`}
            onClick={() => onQty(line.id, line.quantity + 1)}
          >
            <Plus size={15} weight="bold" />
          </Button>
          <span className="ml-1 text-[0.75rem] text-text-tertiary">
            {line.quantity === 1 ? medicine.unitLabel : `${medicine.unitLabel}s`}
          </span>
        </div>

        <div className="min-w-0 text-right">
          <span className="numeric text-[1.0625rem] font-medium text-text">
            {formatPaise(totals.lineTotalPaise)}
          </span>
          <p className="numeric text-[0.6875rem] text-text-tertiary">
            {formatPaiseTight(totals.unitPricePaise)} / {medicine.unitLabel}
          </p>
          {totals.discountPaise > 0 ? (
            <p className="numeric text-[0.6875rem] text-success-text">
              saved {formatPaiseTight(totals.discountPaise)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NumberInput
          size="sm"
          value={discountDraft}
          label="Discount"
          hint={`₹ / ${medicine.unitLabel}`}
          aria-label={`Discount per unit on ${medicine.name}, in rupees`}
          placeholder="0"
          fieldClassName="w-[9rem]"
          onChange={(event) => setDiscountDraft(event.target.value)}
          onBlur={commitDiscount}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDiscount();
            }
          }}
        />
        {canSeeCost ? (
          <p className="mt-4 text-[0.6875rem] text-text-tertiary">
            cost <span className="numeric">{formatPaiseTight(batch.costPaise)}</span> · margin{" "}
            <span className="numeric">{formatBps(marginBpsOf(batch))}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ─────────────────────────── row (md and up) ───────────────────────────

function CartRow(props: CartLineProps) {
  const {
    line,
    medicine,
    batch,
    now,
    warningDays,
    active,
    canSeeCost,
    onActivate,
    onQty,
    onBatch,
    onRemove,
  } = props;
  const { totals, options, fefoId, discountDraft, setDiscountDraft, commitDiscount } =
    useCartLine(props);
  const handleKeyDown = useLineKeys(props);

  return (
    <TableRow
      data-cart-line={line.id}
      tabIndex={0}
      selected={active}
      onFocus={() => onActivate(line.id)}
      onClick={() => onActivate(line.id)}
      onKeyDown={handleKeyDown}
      className="align-top"
    >
      <TableCell className="h-auto px-2 py-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-text">{medicine.name}</span>
            <ScheduleBadge schedule={medicine.schedule} />
          </div>
          {/* Salt names run long and are allowed to wrap. Truncating them here
              would force the column to its intrinsic width and push the line
              total off a laptop screen. */}
          <span className="text-[0.75rem] leading-snug text-text-secondary">
            {medicine.genericName}
          </span>
        </div>
      </TableCell>

      <TableCell className="h-auto px-2 py-2">
        <BatchSelect
          lineId={line.id}
          medicine={medicine}
          batch={batch}
          options={options}
          fefoId={fefoId}
          now={now}
          warningDays={warningDays}
          className="w-full max-w-[9rem]"
          onActivate={onActivate}
          onBatch={onBatch}
        />

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="numeric text-[0.6875rem] text-text-secondary">
            exp {formatExpiry(batch.expiryDate)}
          </span>
          <ExpiryBadge expiryDate={batch.expiryDate} now={now} warningDays={warningDays} />
        </div>

        {canSeeCost ? (
          <p className="mt-1 text-[0.6875rem] text-text-tertiary">
            cost <span className="numeric">{formatPaiseTight(batch.costPaise)}</span> · margin{" "}
            <span className="numeric">{formatBps(marginBpsOf(batch))}</span>
          </p>
        ) : null}
      </TableCell>

      <TableCell numeric className="h-auto px-2 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="size-6"
            aria-label={`Reduce ${medicine.name} by one`}
            onClick={() => onQty(line.id, line.quantity - 1)}
          >
            <Minus size={12} weight="bold" />
          </Button>
          <span className="numeric w-7 text-center text-[0.875rem] font-medium text-text">
            {line.quantity}
          </span>
          <Button
            size="icon"
            variant="secondary"
            className="size-6"
            aria-label={`Add one more ${medicine.name}`}
            onClick={() => onQty(line.id, line.quantity + 1)}
          >
            <Plus size={12} weight="bold" />
          </Button>
        </div>
        <p className="mt-1 text-right text-[0.6875rem] text-text-tertiary">
          {line.quantity === 1 ? medicine.unitLabel : `${medicine.unitLabel}s`}
        </p>
      </TableCell>

      <TableCell numeric className="h-auto px-2 py-2">
        <NumberInput
          size="sm"
          value={discountDraft}
          aria-label={`Discount per unit on ${medicine.name}, in rupees`}
          placeholder="0"
          fieldClassName="ml-auto w-[3.5rem]"
          onChange={(event) => setDiscountDraft(event.target.value)}
          onBlur={commitDiscount}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDiscount();
            }
          }}
        />
      </TableCell>

      <TableCell numeric className="h-auto px-2 py-2">
        <span className="font-medium text-text">{formatPaise(totals.lineTotalPaise)}</span>
        {/* Unit price stays on the row, one line down: at eight columns the
            counter starts scrolling sideways, and the number a customer asks
            about is the line total. */}
        <p className="text-[0.6875rem] text-text-tertiary">
          {formatPaiseTight(totals.unitPricePaise)} / {medicine.unitLabel}
          {totals.unitPricePaise < totals.mrpPaise
            ? ` · MRP ${formatPaiseTight(totals.mrpPaise)}`
            : ""}
        </p>
        {totals.discountPaise > 0 ? (
          <p className="text-[0.6875rem] text-success-text">
            saved {formatPaiseTight(totals.discountPaise)}
          </p>
        ) : null}
      </TableCell>

      <TableCell className="h-auto px-1 py-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={`Remove ${medicine.name} from the cart`}
          onClick={() => onRemove(line.id)}
        >
          <Trash size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
