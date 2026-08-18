"use client";

import { useLayoutEffect, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** useLayoutEffect warns during SSR; on the server there is nothing to lay out. */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Scopes a GSAP setup function to a container and reverts it on unmount.
 *
 * `gsap.context` is what makes this safe in React: every tween and ScrollTrigger
 * created inside the callback is recorded, and `ctx.revert()` kills all of them
 * plus restores inline styles. Without it, StrictMode's double-invoke and every
 * route change leak triggers that then fight each other over the same elements.
 */
export function useGsap(
  setup: (context: gsap.Context) => void,
  deps: React.DependencyList = [],
) {
  const scope = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context((self) => setup(self), scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scope;
}

/**
 * True when the visitor asked for less motion. Read at setup time so a whole
 * timeline can be skipped rather than played at zero duration, which still
 * costs work and can still flash.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger };
