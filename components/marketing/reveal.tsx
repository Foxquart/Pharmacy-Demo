"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** "load" plays on mount (hero choreography). "scroll" waits for the viewport. */
  trigger?: "load" | "scroll";
  /** Stagger offset in ms. Keep siblings 60-80ms apart. */
  delay?: number;
  /** Travel distance in px. Only transform and opacity are ever animated. */
  distance?: number;
  className?: string;
  as?: ElementType;
};

/**
 * Entrance and scroll-reveal choreography. Plain IntersectionObserver, no
 * animation library. Transform and opacity only, and it resolves straight to
 * the settled state when the reader has asked for reduced motion.
 */
export function Reveal({
  children,
  trigger = "scroll",
  delay = 0,
  distance = 20,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const settleNow = () => {
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    };

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = ref.current;

    if (
      prefersReducedMotion ||
      trigger === "load" ||
      typeof IntersectionObserver === "undefined" ||
      !node
    ) {
      return settleNow();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [trigger]);

  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      className={cn(
        "transition-[opacity,transform] duration-[720ms] ease-[var(--ease-out-expo)] motion-reduce:transition-none",
        className,
      )}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translate3d(0, ${distance}px, 0)`,
        transitionDelay: `${delay}ms`,
        willChange: shown ? undefined : "transform, opacity",
      }}
    >
      {children}
    </Tag>
  );
}
