"use client";

import * as React from "react";
import { Barcode, MagnifyingGlass } from "@phosphor-icons/react";

import { Input, Kbd } from "@/components/ui";
import { fefoBatch, totalStockFor } from "@/lib/domain/selectors";
import { formatPaiseTight } from "@/lib/domain/money";
import type { Batch, Medicine } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { ExpiryBadge, ScheduleBadge, StockBadge } from "./expiry-badge";

export interface CounterSearchProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  results: Medicine[];
  highlight: number;
  onHighlight: (index: number) => void;
  onAdd: (medicineId: string) => void;
  batches: Batch[];
  now: Date;
  warningDays: number;
  /** ArrowDown with no results moves the operator into the cart. */
  onEnterCart: () => void;
  onEscape: () => void;
  /** `+` / `-` with an empty query adjust the highlighted cart line. */
  onQuantityKey: (delta: number) => void;
  onDeleteKey: () => void;
}

/**
 * One box, always focused, doing brand, salt, manufacturer and barcode at once.
 *
 * `data-barcode-target` is deliberate: the global scanner hook skips editable
 * elements unless they opt in, and this field must stay focused all shift while
 * still letting a hardware scan be recognised as a scan rather than as typing.
 */
export function CounterSearch({
  inputRef,
  query,
  onQueryChange,
  results,
  highlight,
  onHighlight,
  onAdd,
  batches,
  now,
  warningDays,
  onEnterCart,
  onEscape,
  onQuantityKey,
  onDeleteKey,
}: CounterSearchProps) {
  const listId = React.useId();
  const open = results.length > 0;
  const activeId = open ? `${listId}-option-${highlight}` : undefined;

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        onEnterCart();
        return;
      }
      onHighlight((highlight + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      onHighlight((highlight - 1 + results.length) % results.length);
      return;
    }

    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const medicine = results[highlight];
      if (medicine) onAdd(medicine.id);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }

    // With nothing typed there is no search to interfere with, so the quantity
    // keys reach the highlighted cart line without the operator ever having to
    // leave the field their scanner and their hands are already pointed at.
    if (query.length === 0) {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        onQuantityKey(1);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        onQuantityKey(-1);
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        onDeleteKey();
      }
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        size="lg"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label="Search the catalogue by brand, salt, manufacturer or barcode"
        placeholder="Scan a barcode, or search by brand or salt"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-barcode-target=""
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        leadingIcon={<MagnifyingGlass size={17} />}
        trailing={<Kbd size="sm">F2</Kbd>}
      />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className={cn(
            "absolute z-20 mt-1.5 w-full overflow-hidden",
            "rounded-[var(--radius-md)] border border-border bg-surface-raised shadow-lg",
            "motion-safe:animate-[ui-pop-in_140ms_var(--ease-out-quart)]",
          )}
        >
          {results.map((medicine, index) => (
            <ResultRow
              key={medicine.id}
              id={`${listId}-option-${index}`}
              medicine={medicine}
              batches={batches}
              now={now}
              warningDays={warningDays}
              active={index === highlight}
              onHover={() => onHighlight(index)}
              onSelect={() => onAdd(medicine.id)}
            />
          ))}
        </ul>
      ) : null}

      {query.trim().length > 0 && results.length === 0 ? (
        <div className="absolute z-20 mt-1.5 w-full rounded-[var(--radius-md)] border border-border bg-surface-raised px-4 py-3.5 shadow-lg">
          <p className="text-[0.8125rem] text-text-secondary">
            Nothing matches{" "}
            <span className="numeric text-text">{query.trim()}</span>. Try the salt name, or
            scan the pack.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface ResultRowProps {
  id: string;
  medicine: Medicine;
  batches: Batch[];
  now: Date;
  warningDays: number;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}

function ResultRow({
  id,
  medicine,
  batches,
  now,
  warningDays,
  active,
  onHover,
  onSelect,
}: ResultRowProps) {
  const onHand = totalStockFor(medicine.id, batches, now);
  // Price shown is the price this add would actually bill at: the FEFO lot's,
  // not a catalogue MRP that may belong to a different lot on the shelf.
  const pick = fefoBatch(medicine.id, batches, now);

  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(event) => {
        // Keep the search field focused: losing it would break the next scan.
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0",
        "transition-colors duration-100 ease-[var(--ease-out-quart)]",
        active ? "bg-brand-subtle" : "bg-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[0.875rem] font-medium text-text">
            {medicine.name}
          </span>
          <ScheduleBadge schedule={medicine.schedule} />
          {pick ? (
            <ExpiryBadge
              expiryDate={pick.expiryDate}
              now={now}
              warningDays={warningDays}
            />
          ) : null}
        </div>
        <p className="truncate text-[0.75rem] text-text-secondary">{medicine.genericName}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StockBadge
          quantity={onHand}
          reorderLevel={medicine.reorderLevel}
          unitLabel={medicine.unitLabel}
        />
        <span className="numeric w-[4.5rem] text-right text-[0.875rem] font-medium text-text">
          {pick ? formatPaiseTight(Math.min(pick.sellingPaise, pick.mrpPaise)) : "-"}
        </span>
      </div>
    </li>
  );
}

/** The hint that sits under the search box when the counter is idle. */
export function ScanHint({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[0.75rem] text-text-tertiary", className)}>
      <Barcode size={14} aria-hidden="true" />
      A hardware scan adds straight to the cart. No need to click into the field first.
    </p>
  );
}
