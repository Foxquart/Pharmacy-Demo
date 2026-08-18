"use client";

/**
 * The hero's background plates, kept apart from its copy so the z-axis is
 * readable in one glance:
 *
 *   far   soft brand-toned light, the room the shop sits in
 *   mid   a shelving grid pulling up from the floor of the frame
 *   grain a single fixed film plate over the whole shot
 *
 * All three are pure paint. Nothing here reflows, nothing here is measured, and
 * the only property the timelines ever touch on them is `transform`.
 *
 * Colour is built with `color-mix` off the existing tokens rather than hard
 * values, so the whole atmosphere re-tunes itself when `.dark` remaps the
 * palette instead of needing a second, separately-drifting definition.
 */

/** Warm ink-teal light from the upper left, a quieter answer from the right,
 *  and a warm neutral bloom sitting on the floor of the frame. */
const FAR_LIGHT = [
  "radial-gradient(64% 54% at 12% 2%, color-mix(in oklab, var(--brand) 26%, transparent) 0%, transparent 70%)",
  "radial-gradient(50% 58% at 94% 18%, color-mix(in oklab, var(--brand) 15%, transparent) 0%, transparent 72%)",
  "radial-gradient(78% 46% at 54% 106%, color-mix(in oklab, var(--border-strong) 62%, transparent) 0%, transparent 72%)",
].join(", ");

/** Shelf runs and uprights. Hairlines only, and masked so they exist as a
 *  suggestion of depth at the foot of the frame, not as a visible grid. */
const MID_GRID = [
  "repeating-linear-gradient(to bottom, color-mix(in oklab, var(--border-strong) 52%, transparent) 0px, color-mix(in oklab, var(--border-strong) 52%, transparent) 1px, transparent 1px, transparent 94px)",
  "repeating-linear-gradient(to right, color-mix(in oklab, var(--border-strong) 30%, transparent) 0px, color-mix(in oklab, var(--border-strong) 30%, transparent) 1px, transparent 1px, transparent 152px)",
].join(", ");

const MID_MASK = "radial-gradient(104% 70% at 50% 118%, black 0%, black 20%, transparent 72%)";

/** Fractal noise, tiled. Rendered once by the browser into a 180px tile and
 *  then reused, so the cost is a single composited layer rather than per-frame
 *  paint. It lives on a `fixed` element for exactly that reason. */
const GRAIN_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

export function HeroFarLight() {
  return (
    <div
      data-hero-far
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-[8%] -top-[18%] -bottom-[14%] z-0"
      style={{ backgroundImage: FAR_LIGHT }}
    />
  );
}

export function HeroMidGrid() {
  return (
    <div
      data-hero-mid
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-[10%] -bottom-[16%] z-0"
      style={{
        backgroundImage: MID_GRID,
        maskImage: MID_MASK,
        WebkitMaskImage: MID_MASK,
      }}
    />
  );
}

/**
 * Fixed, so it never repaints as the page moves under it, and never inside a
 * scrolling container. It belongs to this one shot, so a scrubbed fade retires
 * it as the hero leaves rather than taxing every section below.
 */
export function HeroGrain() {
  return (
    <div
      data-hero-grain
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 opacity-[0.045] dark:opacity-[0.075]"
      style={{ backgroundImage: GRAIN_TILE, backgroundSize: "180px 180px" }}
    />
  );
}
