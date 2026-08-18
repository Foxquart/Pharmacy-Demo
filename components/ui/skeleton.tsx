import * as React from "react";
import { cn } from "@/lib/utils";
import "./animations.css";

/* Skeletons mirror the shape of the content that replaces them — same heights,
   same column count, same rhythm — so the page does not reflow on load. The
   shimmer is a background-position sweep on a gradient; nothing here animates
   width or height. */

export interface SkeletonProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Turn the sweep off for very large grids where a static block is calmer. */
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[var(--radius-sm)] bg-bg-sunken",
        shimmer && "ui-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Number of lines. The last line is short, the way real text ends. */
  lines?: number;
  /** Line height, matched to the text it stands in for. */
  lineClassName?: string;
}

export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
  ...props
}: SkeletonTextProps) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 && "w-3/5", lineClassName)}
        />
      ))}
    </div>
  );
}

export interface SkeletonRowProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Column count — match the real table so the header does not jump. */
  columns?: number;
  /** Relative widths per column, e.g. `[3, 1, 1, 2]`. */
  widths?: number[];
}

/** One table row's worth of placeholder, at the same 36px height as `TableCell`. */
export function SkeletonRow({
  columns = 4,
  widths,
  className,
  ...props
}: SkeletonRowProps) {
  const cols = widths?.length ?? columns;
  return (
    <div
      className={cn("flex h-9 items-center gap-3 border-b border-border px-3", className)}
      {...props}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="min-w-0 flex-1" style={{ flexGrow: widths?.[i] ?? 1 }}>
          <Skeleton className="h-3 w-full max-w-[12rem]" />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonCardProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Reserve space for a description block under the title. */
  lines?: number;
  showMedia?: boolean;
}

export function SkeletonCard({
  lines = 2,
  showMedia = false,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface p-5",
        className,
      )}
      {...props}
    >
      {showMedia ? <Skeleton className="mb-4 h-28 w-full rounded-[var(--radius-md)]" /> : null}
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-[var(--radius)]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {lines > 0 ? <SkeletonText lines={lines} className="mt-4" /> : null}
    </div>
  );
}
