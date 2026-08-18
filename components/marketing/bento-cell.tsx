"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Prescription, type Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Cells for the "what we stock" bento.
 *
 * Three genuinely different interiors, not one component rendered at three
 * scales: a large cell carries a blurb and four brand chips, a wide cell reads
 * as a strip, a small cell is a name and the two or three things people ask for
 * by name. The shell (tint, aura, hairline, lift, spotlight) is shared so the
 * grid still reads as one family.
 *
 * COLOUR. Each category owns one hue. A cell sets a single custom property,
 * `--cell-h` (an OKLCH hue angle), and every colour on it is derived from that
 * one number by `BentoHueTokens` below. Lightness and chroma are fixed per
 * theme, so the twelve cells vary in hue only and read as one family rather
 * than a rainbow. `--cell-c` scales chroma down for the one rack that should
 * read as steel rather than as a colour.
 */

/** Whether the rack needs a prescription. The one fact on this page that matters legally. */
export type BentoRx = "all" | "some" | "none";

export interface BentoCategory {
  name: string;
  /** OKLCH hue angle, 0-360. The only colour decision a category makes. */
  hue: number;
  /** Chroma multiplier. 1 unless the category should read muted. */
  chroma?: number;
  icon: Icon;
  rx: BentoRx;
  /** One plain line. Large and wide cells only; small cells go straight to names. */
  blurb?: string;
  /** Real products off the shelves, from the seeded catalogue. */
  brands: string[];
}

/**
 * The per-cell palette, derived from `--cell-h`.
 *
 * Written as a style element rather than into `globals.css` because these
 * belong to one marketing section and nothing else may use them. Lightness is
 * pinned high in light mode and low in dark, so `--text` and `--text-secondary`
 * clear WCAG AA on all twelve tints and `--cell-ink` clears it on the chips it
 * sits in.
 *
 * Mixes with `transparent` are done in oklab on purpose: a polar space would
 * interpolate hue against the other colour's hue and drag the tint off the
 * category's own.
 */
const HUE_TOKENS = `
[data-bento-cell] {
  --cell-tone:       oklch(0.70 calc(0.150 * var(--cell-c, 1)) var(--cell-h));
  --cell-surface:    oklch(0.962 calc(0.042 * var(--cell-c, 1)) var(--cell-h));
  --cell-wash:       color-mix(in oklab, var(--cell-tone) 16%, transparent);
  --cell-chip:       oklch(0.938 calc(0.062 * var(--cell-c, 1)) var(--cell-h));
  --cell-line:       oklch(0.878 calc(0.058 * var(--cell-c, 1)) var(--cell-h));
  --cell-line-hover: oklch(0.800 calc(0.062 * var(--cell-c, 1)) var(--cell-h));
  --cell-ink:        oklch(0.450 calc(0.105 * var(--cell-c, 1)) var(--cell-h));
  --cell-aura:       color-mix(in oklab, var(--cell-tone) 40%, transparent);
  --cell-spot:       color-mix(in oklab, var(--cell-tone) 13%, transparent);
}

.dark [data-bento-cell] {
  --cell-tone:       oklch(0.68 calc(0.155 * var(--cell-c, 1)) var(--cell-h));
  --cell-surface:    oklch(0.268 calc(0.044 * var(--cell-c, 1)) var(--cell-h));
  --cell-wash:       color-mix(in oklab, var(--cell-tone) 10%, transparent);
  --cell-chip:       oklch(0.312 calc(0.058 * var(--cell-c, 1)) var(--cell-h));
  --cell-line:       oklch(0.378 calc(0.048 * var(--cell-c, 1)) var(--cell-h));
  --cell-line-hover: oklch(0.480 calc(0.080 * var(--cell-c, 1)) var(--cell-h));
  --cell-ink:        oklch(0.860 calc(0.095 * var(--cell-c, 1)) var(--cell-h));
  --cell-aura:       color-mix(in oklab, var(--cell-tone) 38%, transparent);
  --cell-spot:       color-mix(in oklab, var(--cell-tone) 14%, transparent);
}
`;

/** Rendered once by the section. Nothing outside the bento reads these. */
export function BentoHueTokens() {
  return <style dangerouslySetInnerHTML={{ __html: HUE_TOKENS }} />;
}

const RX_LABEL: Record<BentoRx, string> = {
  all: "Prescription only",
  some: "Some need a prescription",
  none: "No prescription needed",
};

const RX_STYLE: Record<BentoRx, string> = {
  all: "border-[var(--cell-line-hover)] bg-[var(--cell-chip)] text-[var(--cell-ink)]",
  some: "border-[var(--cell-line-hover)] text-[var(--cell-ink)]",
  none: "border-border text-text-secondary",
};

function RxBadge({ level }: { level: BentoRx }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-normal leading-none",
        RX_STYLE[level],
      )}
    >
      {level === "none" ? null : <Prescription aria-hidden className="h-3.5 w-3.5" />}
      {RX_LABEL[level]}
    </span>
  );
}

function BrandChips({ brands, className }: { brands: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {brands.map((brand) => (
        <li
          key={brand}
          className="max-w-full rounded-full border border-[var(--cell-line)] bg-[var(--cell-chip)] px-2.5 py-1 text-[0.8125rem] leading-none text-[var(--cell-ink)]"
        >
          {brand}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pointer-tracked highlight. Coordinates are written straight onto the node as
 * custom properties: React state on `pointermove` would re-render the whole
 * grid every frame. The rect is cached on enter so the move handler never reads
 * layout. Mouse only, and never under reduced motion.
 */
function useSpotlight() {
  const ref = useRef<HTMLElement | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const enabled = useRef(false);

  useEffect(() => {
    enabled.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const onPointerEnter = useCallback(() => {
    if (!enabled.current || !ref.current) return;
    rect.current = ref.current.getBoundingClientRect();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const node = ref.current;
    const box = rect.current;
    if (!enabled.current || !node || !box || event.pointerType !== "mouse") return;
    node.style.setProperty("--bento-spot-x", `${event.clientX - box.left}px`);
    node.style.setProperty("--bento-spot-y", `${event.clientY - box.top}px`);
  }, []);

  return { ref, onPointerEnter, onPointerMove };
}

function Watermark({ icon: Glyph, className }: { icon: Icon; className: string }) {
  return (
    <Glyph
      aria-hidden
      weight="fill"
      className={cn(
        "pointer-events-none absolute text-[var(--cell-ink)] opacity-[0.13] dark:opacity-[0.20]",
        className,
      )}
    />
  );
}

interface ShellProps {
  hue: number;
  chroma?: number;
  /** Span classes for this cell. Mobile is always one full-width column. */
  className?: string;
  children: ReactNode;
}

function CellShell({ hue, chroma, className, children }: ShellProps) {
  const spotlight = useSpotlight();

  return (
    <li
      data-bento-cell
      style={{ "--cell-h": String(hue), "--cell-c": String(chroma ?? 1) } as CSSProperties}
      onPointerEnter={spotlight.onPointerEnter}
      onPointerMove={spotlight.onPointerMove}
      className={cn("group relative isolate col-span-1 row-span-1", className)}
    >
      {/* Aura. Sits behind the card in the cell's own hue and only peeks past
          its edges. Dropped below 768px, where it buys nothing and costs a blur
          pass on every scroll. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 -bottom-4 top-10 -z-10 hidden rounded-[var(--radius-xl)] bg-[var(--cell-aura)] opacity-60 blur-2xl transition-opacity duration-200 ease-[var(--ease-out-quart)] group-hover:opacity-100 md:block dark:opacity-45 dark:group-hover:opacity-75"
      />

      <article
        ref={spotlight.ref}
        style={{ backgroundImage: "linear-gradient(180deg, var(--cell-wash), transparent 62%)" }}
        className={cn(
          "@container relative flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--cell-line)] bg-[var(--cell-surface)] p-5 shadow-xs transition-[transform,border-color] duration-200 ease-[var(--ease-out-quart)] sm:p-6",
          "group-hover:border-[var(--cell-line-hover)]",
          "motion-safe:group-hover:[transform:translate3d(0,-4px,0)]",
        )}
      >
        {/* Pointer spotlight. Desktop pointers only, and off under reduced motion. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden rounded-[inherit] opacity-0 transition-opacity duration-200 ease-[var(--ease-out-quart)] group-hover:opacity-100 motion-safe:md:block"
          style={{
            background:
              "radial-gradient(16rem 16rem at var(--bento-spot-x, 50%) var(--bento-spot-y, 0%), var(--cell-spot), transparent 72%)",
          }}
        />
        {children}
      </article>
    </li>
  );
}

interface CellProps {
  category: BentoCategory;
  className?: string;
}

/** The four racks the shop actually turns over. Blurb, four names, big watermark. */
export function BentoLargeCell({ category, className }: CellProps) {
  return (
    <CellShell hue={category.hue} chroma={category.chroma} className={className}>
      <Watermark icon={category.icon} className="-right-4 -top-4 h-24 w-24 sm:h-28 sm:w-28" />

      <div className="relative flex h-full flex-col">
        <h3 className="pr-14 text-[1.375rem] leading-[1.2] tracking-[-0.018em] text-balance text-text">
          {category.name}
        </h3>
        <p className="mt-2.5 max-w-[34ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary md:max-w-[54ch] lg:max-w-[32ch]">
          {category.blurb}
        </p>

        <BrandChips brands={category.brands} className="mt-auto pt-6" />

        <div className="mt-4">
          <RxBadge level={category.rx} />
        </div>
      </div>
    </CellShell>
  );
}

/** A strip across the grid: name and line on the left, names on the right. */
export function BentoWideCell({ category, className }: CellProps) {
  return (
    <CellShell hue={category.hue} chroma={category.chroma} className={className}>
      <Watermark icon={category.icon} className="-bottom-4 right-2 h-20 w-20" />

      <div className="relative flex h-full flex-col gap-4 @[42rem]:flex-row @[42rem]:items-center @[42rem]:gap-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.125rem] leading-snug tracking-[-0.018em] text-balance text-text">
            {category.name}
          </h3>
          <p className="mt-1.5 max-w-[42ch] text-[0.875rem] leading-relaxed text-pretty text-text-secondary">
            {category.blurb}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 @[42rem]:w-[17rem] @[42rem]:items-end">
          <BrandChips brands={category.brands} className="@[42rem]:justify-end" />
          <RxBadge level={category.rx} />
        </div>
      </div>
    </CellShell>
  );
}

/** The rest of the shelves: the name, and what people ask for by name. */
export function BentoSmallCell({ category, className }: CellProps) {
  return (
    <CellShell hue={category.hue} chroma={category.chroma} className={className}>
      <Watermark icon={category.icon} className="-bottom-3 -right-2 h-16 w-16" />

      <div className="relative flex h-full flex-col">
        <h3 className="text-[1.0625rem] leading-snug tracking-[-0.018em] text-balance text-text">
          {category.name}
        </h3>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-pretty text-text-secondary">
          {category.brands.join(", ")}
        </p>

        <div className="mt-auto pt-5">
          <RxBadge level={category.rx} />
        </div>
      </div>
    </CellShell>
  );
}
