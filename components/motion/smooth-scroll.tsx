"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsap";

/**
 * Weighted, inertial scrolling.
 *
 * Native scroll is instantaneous and mechanical; every award-winning site feels
 * the way it does partly because scroll has mass. Lenis interpolates the scroll
 * position, and ScrollTrigger is driven from Lenis's own frame rather than the
 * browser's scroll event, so pinned sections cannot drift out of sync with the
 * content moving underneath them.
 *
 * Disabled entirely under prefers-reduced-motion: hijacking scroll physics is
 * exactly what triggers motion sickness, and a native scrollbar is the correct
 * fallback rather than a faster animation.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.1,
      // Exponential ease-out: fast pickup, long settle. Matches the --ease-out-expo
      // token used everywhere else so scroll and elements share one feel.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch devices already have native inertia tuned by the OS. Overriding it
      // makes a phone feel laggy, never smoother.
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
