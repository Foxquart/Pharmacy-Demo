"use client";

/**
 * `/inventory` — the stock worklist.
 *
 * This is the screen a pharmacist opens to answer three questions: what have I
 * run out of, what is about to expire, and where is it on the shelf. So it is a
 * table with facet counts, not a dashboard: the counts sit ON the filters, which
 * means "9 out of stock" is readable without applying anything.
 *
 * A hardware scan anywhere on this page jumps straight to the product. That is
 * the whole point of the scanner being global rather than bound to a field.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Barcode,
  CalendarX,
  FunnelSimple,
  MagnifyingGlass,
  Package,
  Plus,
  Prohibit,
  X,
} from "@phosphor-icons/react";

import { CAN_SEE_COST } from "@/components/app/nav";
import {
  Button,
  EmptyState,
  Input,
  Kbd,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  SkeletonRow,
  Stat,
} from "@/components/ui";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import { useHotkeys } from "@/lib/hooks/use-hotkeys";
import { formatPaiseTight, roundOffToRupee } from "@/lib/domain/money";
import {
  daysUntil,
  expiryStateOf,
  fefoBatch,
  isExpired,
  lookupByBarcode,
  marginBpsOf,
  searchMedicines,
  stockStateOf,
  totalStockFor,
} from "@/lib/domain/selectors";
import type { Batch, Category, Medicine } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  useCurrentStaff,
  useHydrated,
  usePharmacyStore,
} from "@/lib/store/pharmacy-store";

import { AddStockSheet } from "./add-stock-sheet";
import { InventoryTable, type MedicineRow } from "./inventory-table";
import { ALL_CATEGORIES, useNow, type ExpiryFilter, type StockFilter } from "./shared";

const EXPIRING_SOON_DAYS = 30;
const EXPIRING_HORIZON_DAYS = 90;

// ─────────────────────────── row model ───────────────────────────

function buildRows(
  medicines: Medicine[],
  batches: Batch[],
  categories: Category[],
  warningDays: number,
  now: Date,
): MedicineRow[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // One pass over the lots instead of a filter per SKU: the counter can hold a
  // few thousand batches and this recomputes on every keystroke.
  const lotsByMedicine = new Map<string, Batch[]>();
  for (const batch of batches) {
    const list = lotsByMedicine.get(batch.medicineId);
    if (list) list.push(batch);
    else lotsByMedicine.set(batch.medicineId, [batch]);
  }

  return medicines
    .filter((medicine) => medicine.isActive)
    .map((medicine) => {
      const lots = lotsByMedicine.get(medicine.id) ?? [];
      const onShelf = lots
        .filter((lot) => lot.quantity > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const onHand = totalStockFor(medicine.id, lots, now);
      const earliest = onShelf[0] ?? null;
      const nextLive = onShelf.find((lot) => !isExpired(lot, now)) ?? null;

      let expiredUnits = 0;
      for (const lot of onShelf) {
        if (isExpired(lot, now)) expiredUnits += lot.quantity;
      }

      // Price off the lot that would actually leave the shelf next; when nothing
      // is sellable, fall back to the most recent lot so the row still carries an
      // MRP rather than a dash.
      const priced =
        fefoBatch(medicine.id, lots, now) ??
        lots.slice().sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).pop() ??
        null;

      const category = categoryById.get(medicine.categoryId);

      return {
        medicine,
        categoryName: category?.name ?? "Uncategorised",
        categoryTone: category?.tone ?? "neutral",
        onHand,
        stockState: stockStateOf(onHand, medicine.reorderLevel),
        earliestExpiry: earliest?.expiryDate ?? null,
        expiryState: earliest ? expiryStateOf(earliest.expiryDate, now, warningDays) : null,
        daysToNextExpiry: nextLive ? daysUntil(nextLive.expiryDate, now) : null,
        expiredUnits,
        mrpPaise: priced?.mrpPaise ?? null,
        costPaise: priced?.costPaise ?? null,
        marginBps: priced ? marginBpsOf(priced) : null,
      } satisfies MedicineRow;
    });
}

function matchesStock(row: MedicineRow, filter: StockFilter): boolean {
  return filter === "ALL" || row.stockState === filter;
}

function matchesExpiry(row: MedicineRow, filter: ExpiryFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "EXPIRED") return row.expiredUnits > 0;
  const days = row.daysToNextExpiry;
  if (days === null) return false;
  return days <= (filter === "D30" ? EXPIRING_SOON_DAYS : EXPIRING_HORIZON_DAYS);
}

function matchesCategory(row: MedicineRow, categoryId: string): boolean {
  return categoryId === ALL_CATEGORIES || row.medicine.categoryId === categoryId;
}

function countBy(rows: MedicineRow[], predicate: (row: MedicineRow) => boolean): number {
  let total = 0;
  for (const row of rows) if (predicate(row)) total += 1;
  return total;
}

/** A count rendered inside a filter label. Tabular so the chips do not resize. */
function FilterCount({ children }: { children: React.ReactNode }) {
  return <span className="numeric ml-1.5 text-text-tertiary">{children}</span>;
}

/**
 * The touch form of a facet. Segmented controls with five options do not survive
 * a 360px screen, so below `lg` the same choices become a wrapping row of chips
 * with real 44px targets inside the filter panel.
 */
function FilterChip<T extends string>({
  value,
  current,
  onSelect,
  children,
  ariaLabel,
}: {
  value: T;
  current: T;
  onSelect: (value: T) => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={() => onSelect(value)}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[0.875rem] font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quart)]",
        "active:scale-[0.98]",
        active
          ? "border-brand-border bg-brand-subtle text-brand-text"
          : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────── page ───────────────────────────

export function InventoryView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const now = useNow();

  const medicines = usePharmacyStore((s) => s.medicines);
  const batches = usePharmacyStore((s) => s.batches);
  const categories = usePharmacyStore((s) => s.categories);
  const warningDays = usePharmacyStore((s) => s.settings.expiryWarningDays);
  const staff = useCurrentStaff();
  const canSeeCost = staff ? CAN_SEE_COST.includes(staff.role) : false;

  const [query, setQuery] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState<StockFilter>("ALL");
  const [expiryFilter, setExpiryFilter] = React.useState<ExpiryFilter>("ALL");
  const [categoryId, setCategoryId] = React.useState<string>(ALL_CATEGORIES);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [scannedBarcode, setScannedBarcode] = React.useState<string | undefined>(undefined);

  const searchRef = React.useRef<HTMLInputElement>(null);

  const rows = React.useMemo(
    () => buildRows(medicines, batches, categories, warningDays, now),
    [medicines, batches, categories, warningDays, now],
  );

  // ── search ──
  const searchedIds = React.useMemo(() => {
    if (!query.trim()) return null;
    const hits = searchMedicines(query, medicines, { limit: 500 });
    return new Map(hits.map((medicine, index) => [medicine.id, index]));
  }, [query, medicines]);

  const searched = React.useMemo(() => {
    if (!searchedIds) return rows;
    return rows
      .filter((row) => searchedIds.has(row.medicine.id))
      .sort(
        (a, b) =>
          (searchedIds.get(a.medicine.id) ?? 0) - (searchedIds.get(b.medicine.id) ?? 0),
      );
  }, [rows, searchedIds]);

  // ── facets ──
  // Each facet counts against everything EXCEPT itself, which is what makes the
  // numbers actionable: "Out of stock 9" stays true while another filter is on.
  const stockFacetBase = React.useMemo(
    () =>
      searched.filter(
        (row) => matchesExpiry(row, expiryFilter) && matchesCategory(row, categoryId),
      ),
    [searched, expiryFilter, categoryId],
  );

  const expiryFacetBase = React.useMemo(
    () =>
      searched.filter(
        (row) => matchesStock(row, stockFilter) && matchesCategory(row, categoryId),
      ),
    [searched, stockFilter, categoryId],
  );

  const categoryFacetBase = React.useMemo(
    () =>
      searched.filter(
        (row) => matchesStock(row, stockFilter) && matchesExpiry(row, expiryFilter),
      ),
    [searched, stockFilter, expiryFilter],
  );

  const visible = React.useMemo(
    () => stockFacetBase.filter((row) => matchesStock(row, stockFilter)),
    [stockFacetBase, stockFilter],
  );

  const categoryCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of categoryFacetBase) {
      counts.set(row.medicine.categoryId, (counts.get(row.medicine.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [categoryFacetBase]);

  // ── headline numbers ──
  const stats = React.useMemo(() => {
    let outOfStock = 0;
    let expiringSoon = 0;
    let expiredUnits = 0;
    for (const row of rows) {
      if (row.stockState === "OUT") outOfStock += 1;
      if (row.daysToNextExpiry !== null && row.daysToNextExpiry <= EXPIRING_HORIZON_DAYS) {
        expiringSoon += 1;
      }
      expiredUnits += row.expiredUnits;
    }
    // Capital on the shelf, at cost. Expired lots are excluded: that value is
    // already lost, and counting it would flatter the number.
    let stockValuePaise = 0;
    for (const batch of batches) {
      if (batch.quantity <= 0 || isExpired(batch, now)) continue;
      stockValuePaise += batch.costPaise * batch.quantity;
    }
    return { outOfStock, expiringSoon, expiredUnits, stockValuePaise };
  }, [rows, batches, now]);

  // ── scanning ──
  const handleScan = React.useCallback(
    (code: string) => {
      const match = lookupByBarcode(code, medicines);
      if (match) {
        setQuery("");
        router.push(`/inventory/${match.id}`);
        return;
      }
      toast("Barcode not in the catalogue", {
        description: `Nothing carries ${code}. Add it as a new medicine and the code is kept.`,
        action: {
          label: "Add medicine",
          onClick: () => {
            setScannedBarcode(code);
            setSheetOpen(true);
          },
        },
      });
    },
    [medicines, router],
  );

  // While the add panel is open the scan belongs to that panel, not to this page.
  useBarcodeScanner({ onScan: handleScan, enabled: hydrated && !sheetOpen });

  // The search box is the one control the operator reaches for constantly, so it
  // gets the conventional single-key shortcut rather than a chord.
  useHotkeys({
    "/": () => searchRef.current?.focus(),
    escape: () => searchRef.current?.blur(),
  });

  const filtersActive =
    stockFilter !== "ALL" ||
    expiryFilter !== "ALL" ||
    categoryId !== ALL_CATEGORIES ||
    query.trim().length > 0;

  // The search box has its own control on the compact bar, so it is not counted
  // as one of the filters folded away behind the panel.
  const foldedFilterCount =
    (stockFilter !== "ALL" ? 1 : 0) +
    (expiryFilter !== "ALL" ? 1 : 0) +
    (categoryId !== ALL_CATEGORIES ? 1 : 0);

  function clearFilters() {
    setStockFilter("ALL");
    setExpiryFilter("ALL");
    setCategoryId(ALL_CATEGORIES);
    setQuery("");
    searchRef.current?.focus();
  }

  function openAddSheet() {
    setScannedBarcode(undefined);
    setSheetOpen(true);
  }

  const stockOptions = React.useMemo(
    () => [
      {
        value: "ALL" as const,
        label: (
          <>
            All<FilterCount>{stockFacetBase.length}</FilterCount>
          </>
        ),
        ariaLabel: `All stock states, ${stockFacetBase.length}`,
      },
      {
        value: "OUT" as const,
        label: (
          <>
            Out
            <FilterCount>{countBy(stockFacetBase, (r) => r.stockState === "OUT")}</FilterCount>
          </>
        ),
        ariaLabel: "Out of stock",
      },
      {
        value: "CRITICAL" as const,
        label: (
          <>
            Critical
            <FilterCount>
              {countBy(stockFacetBase, (r) => r.stockState === "CRITICAL")}
            </FilterCount>
          </>
        ),
        ariaLabel: "Critically low",
      },
      {
        value: "LOW" as const,
        label: (
          <>
            Low
            <FilterCount>{countBy(stockFacetBase, (r) => r.stockState === "LOW")}</FilterCount>
          </>
        ),
        ariaLabel: "Low stock",
      },
      {
        value: "OK" as const,
        label: (
          <>
            OK
            <FilterCount>{countBy(stockFacetBase, (r) => r.stockState === "OK")}</FilterCount>
          </>
        ),
        ariaLabel: "In stock",
      },
    ],
    [stockFacetBase],
  );

  const expiryOptions = React.useMemo(
    () => [
      {
        value: "ALL" as const,
        label: (
          <>
            All<FilterCount>{expiryFacetBase.length}</FilterCount>
          </>
        ),
        ariaLabel: `All expiry states, ${expiryFacetBase.length}`,
      },
      {
        value: "EXPIRED" as const,
        label: (
          <>
            Expired
            <FilterCount>{countBy(expiryFacetBase, (r) => r.expiredUnits > 0)}</FilterCount>
          </>
        ),
        ariaLabel: "Has expired stock on the shelf",
      },
      {
        value: "D30" as const,
        label: (
          <>
            30 days
            <FilterCount>
              {countBy(
                expiryFacetBase,
                (r) => r.daysToNextExpiry !== null && r.daysToNextExpiry <= EXPIRING_SOON_DAYS,
              )}
            </FilterCount>
          </>
        ),
        ariaLabel: "Expiring within 30 days",
      },
      {
        value: "D90" as const,
        label: (
          <>
            90 days
            <FilterCount>
              {countBy(
                expiryFacetBase,
                (r) =>
                  r.daysToNextExpiry !== null && r.daysToNextExpiry <= EXPIRING_HORIZON_DAYS,
              )}
            </FilterCount>
          </>
        ),
        ariaLabel: "Expiring within 90 days",
      },
    ],
    [expiryFacetBase],
  );

  if (!hydrated) return <InventorySkeleton canSeeCost={canSeeCost} />;

  return (
    <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium tracking-[-0.01em] text-text">Inventory</h1>
          <p className="text-[0.8125rem] text-text-secondary">
            Stock lives on batches. Scan any pack to jump straight to its lots.
          </p>
        </div>
        <Button
          className="max-lg:h-11"
          leftIcon={<Plus size={15} weight="bold" />}
          onClick={openAddSheet}
        >
          Add stock
        </Button>
      </header>

      <section
        aria-label="Stock summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <Stat
          icon={<Package size={14} />}
          label="Active SKUs"
          value={rows.length}
          hint="Listed and sellable"
        />
        <Stat
          icon={<Prohibit size={14} />}
          label="Out of stock"
          value={stats.outOfStock}
          hint={stats.outOfStock > 0 ? "Nothing sellable on the shelf" : "Every SKU has stock"}
        />
        <Stat
          icon={<CalendarX size={14} />}
          label="Expiring in 90 days"
          value={stats.expiringSoon}
          unit="SKUs"
          hint="Move them or return them"
        />
        <Stat
          icon={<CalendarX size={14} />}
          label="Expired on shelf"
          value={stats.expiredUnits}
          unit="units"
          hint="Not counted as stock. Write them off."
        />
        {canSeeCost ? (
          <Stat
            label="Stock value at cost"
            // Rounded to the rupee: this is a headline, and paise in a
            // six-figure number are noise that only makes the tile overflow.
            value={formatPaiseTight(roundOffToRupee(stats.stockValuePaise).rounded)}
            hint="Sellable lots only"
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brand, salt, manufacturer or barcode"
            aria-label="Search the catalogue"
            size="sm"
            fieldClassName="w-full max-w-sm max-lg:w-auto max-lg:min-w-0 max-lg:flex-1"
            leadingIcon={<MagnifyingGlass size={14} />}
            // Opted in so a scan lands here as a scan, not as typed text.
            data-barcode-target=""
            trailing={
              query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="inline-flex size-5 items-center justify-center rounded-[var(--radius-sm)] text-text-tertiary transition-colors duration-150 ease-[var(--ease-out-quart)] hover:text-text"
                >
                  <X size={12} weight="bold" />
                </button>
              ) : (
                <Barcode size={14} />
              )
            }
          />

          {/* Below `lg` the three facets collapse behind one control rather than
              stacking five full-width selects down the page. */}
          <Button
            variant="secondary"
            className="h-11 shrink-0 lg:hidden"
            leftIcon={<FunnelSimple size={16} />}
            onClick={() => setFiltersOpen(true)}
          >
            Filters
            {foldedFilterCount > 0 ? (
              <span className="numeric ml-1 rounded-full bg-brand-subtle px-1.5 py-0.5 text-[0.75rem] text-brand-text">
                {foldedFilterCount}
              </span>
            ) : null}
          </Button>

          <div className="max-lg:hidden">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger size="sm" aria-label="Filter by category" className="w-[13rem]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>
                  All categories ({categoryFacetBase.length})
                </SelectItem>
                {categories
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name} ({categoryCounts.get(category.id) ?? 0})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {filtersActive ? (
            <Button variant="ghost" size="sm" className="max-lg:hidden" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}

          <span className="ml-auto hidden items-center gap-1.5 text-xs text-text-tertiary lg:flex">
            <Barcode size={14} aria-hidden="true" />
            Scan anywhere to open a product
          </span>
        </div>

        {filtersActive ? (
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <span className="min-w-0 truncate text-xs text-text-tertiary">
              <span className="numeric">{visible.length}</span> of{" "}
              <span className="numeric">{rows.length}</span> SKUs shown
            </span>
            <Button variant="ghost" size="sm" className="h-11 shrink-0" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 max-lg:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-tertiary">Stock</span>
            <Segmented
              size="sm"
              aria-label="Filter by stock state"
              options={stockOptions}
              value={stockFilter}
              onValueChange={setStockFilter}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-tertiary">Expiry</span>
            <Segmented
              size="sm"
              aria-label="Filter by expiry state"
              options={expiryOptions}
              value={expiryFilter}
              onValueChange={setExpiryFilter}
            />
          </div>
        </div>
      </section>

      {/* The same facets, laid out for a thumb. */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Stock</span>
              <div className="flex flex-wrap gap-2">
                {stockOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    value={option.value}
                    current={stockFilter}
                    onSelect={setStockFilter}
                    ariaLabel={option.ariaLabel}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Expiry</span>
              <div className="flex flex-wrap gap-2">
                {expiryOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    value={option.value}
                    current={expiryFilter}
                    onSelect={setExpiryFilter}
                    ariaLabel={option.ariaLabel}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Category</span>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger aria-label="Filter by category" className="h-11 w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>
                    All categories ({categoryFacetBase.length})
                  </SelectItem>
                  {categories
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({categoryCounts.get(category.id) ?? 0})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              variant="ghost"
              className="mr-auto h-11"
              onClick={() => {
                setStockFilter("ALL");
                setExpiryFilter("ALL");
                setCategoryId(ALL_CATEGORIES);
              }}
            >
              Reset
            </Button>
            <Button className="h-11" onClick={() => setFiltersOpen(false)}>
              Show <span className="numeric">{visible.length}</span> SKUs
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package size={24} />}
            title="The catalogue is empty"
            description="Add your first medicine and its opening batch. Scan the pack and the barcode is filled in for you."
            action={
              <Button leftIcon={<Plus size={15} weight="bold" />} onClick={openAddSheet}>
                Add a medicine
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<MagnifyingGlass size={24} />}
            title="No medicine matches these filters"
            description={
              query.trim()
                ? `Nothing in the catalogue matches "${query.trim()}" with the current stock and expiry filters.`
                : "The stock, expiry and category filters have no overlap right now."
            }
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" onClick={openAddSheet}>
                Add a medicine
              </Button>
            }
            footer={
              <>
                <Kbd size="sm">/</Kbd>
                <span>focuses search</span>
              </>
            }
          />
        ) : (
          <>
            <InventoryTable rows={visible} canSeeCost={canSeeCost} />
            <p className="border-t border-border px-3 py-2 text-xs text-text-tertiary">
              <span className="numeric">{visible.length}</span> of{" "}
              <span className="numeric">{rows.length}</span> SKUs
              {canSeeCost ? null : " · cost and margin are hidden for this role"}
            </p>
          </>
        )}
      </section>

      <AddStockSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialBarcode={scannedBarcode}
      />
    </div>
  );
}

function InventorySkeleton({ canSeeCost }: { canSeeCost: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4 px-4 py-5 sm:px-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: canSeeCost ? 5 : 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.5rem] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <Skeleton className="h-[6.5rem] rounded-[var(--radius-lg)]" />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {Array.from({ length: 10 }).map((_, index) => (
          <SkeletonRow key={index} widths={[4, 2, 1, 1, 1, 2, 2, 1]} />
        ))}
      </div>
    </div>
  );
}
