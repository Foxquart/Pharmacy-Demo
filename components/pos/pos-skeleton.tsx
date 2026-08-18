"use client";

import { Skeleton, SkeletonRow } from "@/components/ui";

/**
 * First paint, before the store has read itself back out of localStorage.
 *
 * The shapes match the real counter exactly (same search height, same 36px
 * rows, same rail width) so nothing reflows when the data lands. Rendering the
 * real screen here instead would either flash an empty cart at an operator who
 * has one open, or trip a hydration mismatch.
 */
export function PosSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        <Skeleton className="h-11 w-full rounded-[var(--radius)]" />

        <div className="mt-5 rounded-[var(--radius-lg)] border border-border bg-surface">
          <div className="flex h-9 items-center gap-3 border-b border-border px-3">
            <Skeleton className="h-3 w-24" />
          </div>
          {[0, 1, 2, 3].map((row) => (
            <SkeletonRow key={row} widths={[4, 3, 2, 2, 2]} className="border-b-0" />
          ))}
        </div>
      </div>

      <aside className="hidden w-[20rem] shrink-0 flex-col gap-4 border-l border-border bg-surface p-4 lg:flex xl:w-[22rem] xl:p-5">
        <Skeleton className="h-9 w-full rounded-[var(--radius-md)]" />
        <div className="flex flex-col gap-3 pt-2">
          {[0, 1, 2, 3, 4].map((line) => (
            <div key={line} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-auto h-12 w-full rounded-[var(--radius-md)]" />
      </aside>
    </div>
  );
}
