"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import { List } from "@phosphor-icons/react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";
import { gsap, prefersReducedMotion, ScrollTrigger, useGsap } from "@/components/motion/gsap";

/** Store-only navigation. The counter tool sits beside it as a secondary action. */
const SECTIONS = [
  { href: "/#stock", label: "What we stock" },
  { href: "/#visit", label: "Visit us" },
  { href: "/#trust", label: "Why people trust us" },
];

const PHONE = "tel:+918045127788";

/**
 * Sticky, one line, 64px tall. It rides transparent over the hero and then
 * gains a ground and a hairline once the reader is past it.
 *
 * The state change is driven by a ScrollTrigger rather than a scroll listener,
 * so it shares the same scroll frame as every other timeline on the page and
 * cannot tear away from them under Lenis.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const groundRef = useRef<HTMLDivElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);

  /**
   * On the storefront itself the wordmark is a "back to the top" control, since
   * a plain link to `/` does nothing when you are already there. Scrolling the
   * document element is what Lenis observes, so smooth scroll stays in charge
   * instead of fighting a `window.scrollTo`. Modified clicks and every other
   * route fall through to the real link underneath.
   */
  const onWordmarkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const scope = useGsap(() => {
    const ground = groundRef.current;
    const hairline = hairlineRef.current;
    if (!ground || !hairline) return;

    // Off the storefront there is no hero to ride over, and under reduced
    // motion there is no state worth crossing. Both land grounded on frame one.
    if (pathname !== "/" || prefersReducedMotion()) {
      gsap.set(ground, { opacity: 1 });
      gsap.set(hairline, { scaleX: 1 });
      return;
    }

    const settle = gsap
      .timeline({ paused: true })
      .to(ground, { opacity: 1, duration: 0.45, ease: "power3.out" }, 0)
      .to(hairline, { scaleX: 1, duration: 0.6, ease: "power3.out" }, 0);

    const threshold = () => Math.min(window.innerHeight * 0.55, 420);

    ScrollTrigger.create({
      start: threshold,
      end: "max",
      onEnter: () => settle.play(),
      onLeaveBack: () => settle.reverse(),
    });

    // Deep link or a restored scroll position: land already grounded rather
    // than playing a transition the reader never asked for.
    if (window.scrollY > threshold()) settle.progress(1).pause();
  }, [pathname]);

  return (
    <header ref={scope} className="sticky top-0 z-50">
      <div
        ref={groundRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-bg/80 opacity-0 backdrop-blur-xl"
      />
      <div
        ref={hairlineRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-border"
      />

      <div className="relative mx-auto flex h-16 w-full max-w-[76rem] items-center gap-4 px-6 sm:gap-6 sm:px-8">
        <Link
          href="/"
          onClick={onWordmarkClick}
          className="flex shrink-0 items-baseline gap-1.5 rounded-[var(--radius-sm)]"
        >
          <span className="text-[1.0625rem] font-medium tracking-[-0.018em] text-text">Meridian</span>
          <span className="text-[1.0625rem] font-normal tracking-[-0.018em] text-text-secondary">
            Pharmacy
          </span>
        </Link>

        <nav aria-label="Sections" className="ml-auto hidden items-center gap-6 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="group relative rounded-[var(--radius-sm)] text-[0.875rem] text-text-secondary transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text"
            >
              {section.label}
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-brand transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-x-100"
              />
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-6">
          <Link
            href="/pos"
            className="hidden h-9 items-center justify-center rounded-[var(--radius-md)] border border-border px-3.5 text-[0.875rem] font-medium text-text-secondary transition-[background-color,border-color,color] duration-200 ease-[var(--ease-out-quart)] hover:border-border-strong hover:bg-surface-hover hover:text-text sm:inline-flex"
          >
            Staff login
          </Link>
          <a
            href={PHONE}
            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-[0.875rem] font-medium text-on-brand shadow-xs transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-brand-hover active:scale-[0.98]"
          >
            Call the counter
          </a>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-border text-text transition-[background-color,border-color] duration-200 ease-[var(--ease-out-quart)] hover:bg-surface-hover lg:hidden"
          >
            <List size={18} weight="bold" />
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" aria-describedby={undefined} className="max-w-[20rem]">
          <SheetHeader>
            <SheetTitle>Meridian Pharmacy</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <nav aria-label="Sections" className="flex flex-col">
              {SECTIONS.map((section) => (
                <a
                  key={section.href}
                  href={section.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-12 items-center rounded-[var(--radius-sm)] border-b border-border text-[1rem] text-text transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-brand-text"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            <a
              href={PHONE}
              onClick={() => setMenuOpen(false)}
              className="mt-6 flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-brand px-5 text-[0.9375rem] font-medium text-on-brand shadow-xs transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-brand-hover active:scale-[0.98]"
            >
              Call the counter
            </a>
            <p className="numeric mt-3 text-center text-[0.875rem] text-text-secondary">
              +91 80 4512 7788
            </p>
            <Link
              href="/pos"
              onClick={() => setMenuOpen(false)}
              className="mt-4 flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-border px-5 text-[0.9375rem] font-medium text-text transition-[background-color,border-color] duration-200 ease-[var(--ease-out-quart)] hover:border-border-strong hover:bg-surface-hover"
            >
              Staff login
            </Link>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </header>
  );
}
