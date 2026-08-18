"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";

/**
 * The storefront's opening shot.
 *
 * One idea, held for two seconds: the shop name rises into place, the studio
 * that built it signs underneath, and then the whole plate lifts away like a
 * shutter going up. The hero is already composed behind it, so the wipe is a
 * cut inside a single continuous shot rather than a screen being swapped.
 *
 * Everything about when it runs is decided before React sees the page:
 *
 *  - `INTRO_BOOT` is an inline script that executes during HTML parse, before
 *    the overlay element is even created. It stamps `data-intro="run"` on
 *    <html> only when the reader has not asked for reduced motion.
 *  - `INTRO_CSS` hides the overlay outright whenever that stamp is absent. A
 *    reduced-motion reader, or a browser with JavaScript
 *    off, therefore never sees a single frame of it, with no flash and no
 *    hydration mismatch, because React still renders identical markup on both
 *    sides and simply drops it on mount.
 *
 * The page underneath is complete in the DOM the whole time. The loader is a
 * lid, never a gate: nothing about the hero's existence depends on it.
 */

/** Fired mid-wipe, while the shutter is still travelling, so the hero's own
 *  entrance is already running by the time the plate clears the type. */
export const INTRO_REVEAL_EVENT = "meridian:intro-reveal";

/** True only while the opening shot is actually on screen. Consumers use this
 *  to decide whether to hold their entrance or play it immediately. */
export function introIsRunning(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.intro === "run";
}

const INTRO_BOOT = `(function(){try{
document.documentElement.setAttribute("data-intro","run");
}catch(e){}})();`;

const INTRO_CSS = [
  `html:not([data-intro="run"]) [data-intro-root]{display:none}`,
  // Hidden, not transparent: `visibility` still reserves the layout, so GSAP
  // measures the real geometry when it sets the opening state.
  `html[data-intro="run"] [data-intro-stack],html[data-intro="run"] [data-intro-bar]{visibility:hidden}`,
].join("");

/* Scroll is not locked with `overflow:hidden`: taking the scrollbar away and
   giving it back shifts the layout by its own width at the exact moment the
   reveal lands. Swallowing the input events instead costs nothing and leaves
   the page geometry untouched. Capture phase, so Lenis never sees them. */
const SCROLL_EVENTS = ["wheel", "touchmove"] as const;
const SCROLL_OPTIONS: AddEventListenerOptions = { passive: false, capture: true };

function swallow(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function holdScroll() {
  for (const name of SCROLL_EVENTS) window.addEventListener(name, swallow, SCROLL_OPTIONS);
}

function releaseScroll() {
  for (const name of SCROLL_EVENTS) window.removeEventListener(name, swallow, SCROLL_OPTIONS);
}

const WORDMARK = "Meridian";

export function IntroLoader() {
  const [mounted, setMounted] = useState(true);
  const doneRef = useRef(false);

  const scope = useGsap(() => {
    // The boot script is the single source of truth. If it did not stamp the
    // document, this visit does not get an intro: drop the node and stop.
    if (!introIsRunning()) {
      setMounted(false);
      return;
    }

    holdScroll();

    // Revealed only now, with the opening state applied in the same
    // synchronous block, so the settled wordmark is never painted.
    gsap.set(["[data-intro-stack]", "[data-intro-bar]"], { visibility: "visible" });

    const settle = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      document.documentElement.setAttribute("data-intro", "done");
      releaseScroll();
      setMounted(false);
    };

    const handOff = () => window.dispatchEvent(new CustomEvent(INTRO_REVEAL_EVENT));

    const timeline = gsap.timeline({ onComplete: settle });

    // Reduced motion gets the same shot with the travel taken out: nothing
    // slides, nothing wipes, only opacity changes. The reader still sees the
    // name and who built it, which is the whole point of the sequence.
    if (prefersReducedMotion()) {
      // The progress hairline has no role in a fade-only cut, and revealing it
      // just to fade it out again reads as a flash. Kept hidden instead.
      gsap.set("[data-intro-bar]", { autoAlpha: 0 });
      timeline
        .from("[data-intro-stack]", { autoAlpha: 0, duration: 0.45, ease: "power1.out" }, 0)
        .to("[data-intro-stack]", { autoAlpha: 0, duration: 0.35, ease: "power1.in" }, 0.95)
        .to("[data-intro-curtain]", { autoAlpha: 0, duration: 0.35, ease: "power1.in" }, 1.05)
        .call(handOff, undefined, 1.05);
      return;
    }

    timeline
      // 0.06s  the wordmark climbs out of its mask, letter by letter.
      .from("[data-intro-char]", {
        yPercent: 118,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.048,
      }, 0.06)
      // 0.08s  a hairline crosses the foot of the screen for the full run.
      .from("[data-intro-bar]", {
        scaleX: 0,
        duration: 1.12,
        ease: "power2.inOut",
      }, 0.08)
      // 0.72s  once the name has settled, the studio signs under it.
      .from("[data-intro-lockup]", {
        autoAlpha: 0,
        y: 14,
        duration: 0.62,
        ease: "expo.out",
      }, 0.72)
      // 1.30s  the type leaves ahead of the plate, so the plate reads as empty.
      .to("[data-intro-stack]", {
        y: -26,
        autoAlpha: 0,
        duration: 0.42,
        ease: "power2.in",
      }, 1.3)
      .to("[data-intro-bar]", { autoAlpha: 0, duration: 0.3, ease: "power1.in" }, 1.3)
      // 1.34s  the shutter goes up.
      .to("[data-intro-curtain]", {
        yPercent: -100,
        duration: 0.76,
        ease: "power4.inOut",
      }, 1.34)
      // 1.64s  mid-travel: the hero starts its own entrance behind the plate.
      .call(handOff, undefined, 1.64);

    // 2.10s  total. Anything longer stops being an intro and becomes a wait.
  }, []);

  // Belt and braces: if this ever unmounts mid-flight (a route change during
  // the shot), scroll must not stay swallowed.
  useEffect(() => releaseScroll, []);

  if (!mounted) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INTRO_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT }} />

      <div ref={scope}>
        {/* Decorative in full: the same words live in the header and the footer,
            so a screen reader gains nothing and loses a page-load by reading
            them here. Nothing inside is focusable, so the tab ring never goes
            behind the plate. */}
        <div
          data-intro-root
          aria-hidden="true"
          aria-busy="true"
          className="pointer-events-none fixed inset-0 z-[100]"
        >
          <div
            data-intro-curtain
            className="absolute inset-0 flex flex-col items-center justify-center bg-bg will-change-transform"
          >
            <div data-intro-stack className="flex flex-col items-center px-6">
              <span className="block text-center text-[clamp(2.75rem,10.5vw,5.25rem)] font-light leading-[1.02] tracking-[-0.018em] text-text">
                {WORDMARK.split("").map((character, index) => (
                  <span
                    key={`${character}-${index}`}
                    className="inline-block -mb-[0.14em] overflow-hidden pb-[0.14em]"
                  >
                    <span data-intro-char className="inline-block will-change-transform">
                      {character}
                    </span>
                  </span>
                ))}
              </span>

              <span
                data-intro-lockup
                className="mt-7 inline-flex items-center gap-2 will-change-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/foxquart-logo.svg"
                  alt=""
                  width={18}
                  height={18}
                  className="size-[18px] rounded-[4px]"
                />
                <span className="text-[0.875rem] font-normal text-text-secondary">
                  Built by Foxquart
                </span>
              </span>
            </div>

            {/* Progress, stated as thinly as it can be: one hairline across the
                foot of the frame. No spinner, no percentage counting itself up. */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-border">
              <div
                data-intro-bar
                className="h-full w-full origin-left bg-brand will-change-transform"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
