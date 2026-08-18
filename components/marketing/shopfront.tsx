"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";
import { OpenNow } from "./open-now";
import { HeroFarLight, HeroGrain, HeroMidGrid } from "./hero-atmosphere";
import { INTRO_REVEAL_EVENT, introIsRunning } from "./intro-loader";

/**
 * The storefront's opening frame.
 *
 * Built as a real z-axis rather than a flat band of text, because depth is the
 * only thing that makes a page of type feel photographed:
 *
 *   far   brand-toned light, parallaxed slowest so it reads as distance
 *   mid   a shelving grid rising off the floor of the frame
 *   near  the headline and the actions, which leave fastest and fade
 *   plate the counter facts, sitting on the floor as the foreground band
 *   grain one fixed film layer over the whole shot
 *
 * The entrance is deliberately not self-starting when the intro loader is up.
 * It waits for the loader's mid-wipe handoff, so the shutter lifting and the
 * headline arriving are one continuous move instead of two animations that
 * happen to be adjacent. If that signal never comes, a guard timer plays it
 * anyway; the hero is never allowed to depend on the loader to exist.
 *
 * Everything here animates `transform` and `opacity` only, and none of it runs
 * at all under `prefers-reduced-motion`, where the markup's natural state is
 * already the settled one.
 */

const PHONE_HREF = "tel:+918045127788";

/** Everything the entrance timeline moves. Collected so `will-change` can be
 *  granted for the length of the shot and handed straight back afterwards. */
const MOVERS =
  "[data-hero-chip],[data-hero-line],[data-hero-sub],[data-hero-action],[data-hero-note],[data-hero-fact]";

/** The four things a customer checks before deciding to walk over, in the order
 *  they check them. The address runs last because it is the only one that needs
 *  more than a line, and a ragged block reads as a terminus rather than a gap. */
const COUNTER_FACTS = [
  { label: "Monday to Saturday", value: "8:30 am to 10:30 pm", numeric: true },
  { label: "Sunday", value: "9:00 am to 9:00 pm", numeric: true },
  { label: "Licensed since 2019", value: "KA-B-20/2019-1147", numeric: true },
  {
    label: "On the 4th Cross corner",
    value: "No. 42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
    numeric: false,
  },
];

export function Shopfront() {
  const sectionRef = useRef<HTMLElement>(null);
  const entranceRef = useRef<gsap.core.Timeline | null>(null);

  const scope = useGsap(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Reduced motion: no entrance, no parallax, no scrub. The DOM already holds
    // the settled composition, so the correct implementation is to do nothing.
    if (prefersReducedMotion()) return;

    /* ── the room settles ──────────────────────────────────────────────────
       Unconditional and immediate. When the intro loader is running this plays
       out behind the curtain, which is the point: the plate lifts to reveal a
       hero whose first frame is already lit and composed, not one that starts
       from nothing the moment it becomes visible. */
    gsap
      .timeline()
      .from("[data-hero-far]", { autoAlpha: 0, scale: 1.07, duration: 1.5, ease: "power2.out" }, 0)
      // `y` in pixels here, `yPercent` on the scrub below: GSAP composes the two
      // independently, so the entrance and the parallax never overwrite each other.
      .from("[data-hero-mid]", { autoAlpha: 0, y: 26, duration: 1.3, ease: "power3.out" }, 0.1);

    /* ── the type arrives ──────────────────────────────────────────────────
       Held paused when the loader owns the screen; released mid-wipe. */
    gsap.set(MOVERS, { willChange: "transform, opacity" });

    const entrance = gsap.timeline({
      paused: introIsRunning(),
      onComplete: () => gsap.set(MOVERS, { willChange: "auto" }),
    });

    entrance
      .from("[data-hero-chip]", { autoAlpha: 0, y: 14, duration: 0.7, ease: "power3.out" }, 0)
      // Per line, out from behind its own mask. A fade would say nothing; this
      // says the words were always there and the frame just caught up to them.
      .from("[data-hero-line]", {
        yPercent: 116,
        duration: 1.05,
        ease: "expo.out",
        stagger: 0.09,
      }, 0.06)
      .from("[data-hero-sub]", { autoAlpha: 0, y: 18, duration: 0.8, ease: "expo.out" }, 0.5)
      .from("[data-hero-action]", {
        autoAlpha: 0,
        y: 16,
        duration: 0.7,
        ease: "expo.out",
        stagger: 0.07,
      }, 0.62)
      .from("[data-hero-note]", { autoAlpha: 0, y: 14, duration: 0.7, ease: "expo.out" }, 0.76)
      .from("[data-hero-rule]", { scaleX: 0, duration: 1.05, ease: "power3.out" }, 0.6)
      .from("[data-hero-fact]", {
        autoAlpha: 0,
        y: 22,
        duration: 0.85,
        ease: "expo.out",
        stagger: 0.06,
      }, 0.72);

    entranceRef.current = entrance;

    /* ── the camera pulls back ─────────────────────────────────────────────
       One trigger, four rates. `ease: "none"` is mandatory on a scrub: any
       curve here would fight the reader's own scroll velocity. */
    const scrubbed = (target: string, vars: gsap.TweenVars) =>
      gsap.to(target, {
        ...vars,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
          onEnter: () => gsap.set(target, { willChange: "transform" }),
          onEnterBack: () => gsap.set(target, { willChange: "transform" }),
          onLeave: () => gsap.set(target, { willChange: "auto" }),
          onLeaveBack: () => gsap.set(target, { willChange: "auto" }),
        },
      });

    gsap.set("[data-hero-far],[data-hero-mid],[data-hero-copy],[data-hero-band]", {
      willChange: "transform",
    });

    scrubbed("[data-hero-far]", { yPercent: 16 });
    scrubbed("[data-hero-mid]", { yPercent: 8 });
    scrubbed("[data-hero-copy]", { y: -94, opacity: 0.05 });
    scrubbed("[data-hero-band]", { y: -34, opacity: 0.25 });

    // The grain belongs to this shot only. Retiring it as the hero leaves keeps
    // a full-screen fixed layer off every section below it.
    gsap.to("[data-hero-grain]", {
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
    });
  }, []);

  // The handoff. Registered ~1.6s before the loader fires, and guarded so a
  // failed or absent loader can never leave the hero stuck at opacity zero.
  useEffect(() => {
    const entrance = entranceRef.current;
    if (!entrance || !entrance.paused()) return;

    const play = () => entrance.play();
    window.addEventListener(INTRO_REVEAL_EVENT, play, { once: true });
    const guard = window.setTimeout(play, 3400);

    return () => {
      window.removeEventListener(INTRO_REVEAL_EVENT, play);
      window.clearTimeout(guard);
    };
  }, []);

  return (
    <div ref={scope} className="-mt-16">
      <section
        ref={sectionRef}
        aria-labelledby="shopfront-title"
        className="relative isolate flex min-h-[min(100svh,58rem)] flex-col overflow-hidden border-b border-border"
      >
        <HeroFarLight />
        <HeroMidGrid />

        <div className="relative z-10 mx-auto flex w-full max-w-[76rem] flex-1 flex-col justify-center px-6 pb-16 pt-32 sm:px-8 lg:pb-16 lg:pt-32">
          <div data-hero-copy>
            <div data-hero-chip>
              <OpenNow />
            </div>

            <h1
              id="shopfront-title"
              className="mt-7 max-w-[64rem] text-[clamp(2.25rem,5.8vw,4.75rem)] font-light leading-[1.06] tracking-[-0.018em] text-text"
            >
              {/* Each line is its own mask. Overflow is clipped a little below
                  the baseline so descenders are never sliced at rest. */}
              <span className="block -mb-[0.12em] overflow-hidden pb-[0.12em]">
                <span data-hero-line className="block">
                  Your Everyday Pharmacy,
                </span>
              </span>
              <span className="block -mb-[0.12em] overflow-hidden pb-[0.12em]">
                <span data-hero-line className="block text-brand-text">
                  Right Around the Corner
                </span>
              </span>
            </h1>

            <p
              data-hero-sub
              className="mt-8 max-w-[52ch] text-[1.0625rem] font-normal leading-relaxed text-pretty text-text-secondary sm:text-[1.125rem]"
            >
              Prescriptions, everyday medicines and first aid, handed straight over the counter in
              HAL 2nd Stage, Indiranagar.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                data-hero-action
                href={PHONE_HREF}
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-brand px-7 text-[0.9375rem] font-medium text-on-brand shadow-md transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-brand-hover active:scale-[0.98]"
              >
                Call the counter
              </a>
              <a
                data-hero-action
                href="#visit"
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-border-strong bg-[color-mix(in_oklab,var(--surface)_72%,transparent)] px-7 text-[0.9375rem] font-medium text-text transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-surface-hover active:scale-[0.98]"
              >
                Find the shop
              </a>
            </div>

            <p
              data-hero-note
              className="mt-8 max-w-[52ch] text-[0.9375rem] font-normal leading-relaxed text-pretty text-text-secondary"
            >
              Family run, at the same address since <span className="numeric">2019</span>. A
              registered pharmacist is on the counter every hour we are open, on{" "}
              <a
                href={PHONE_HREF}
                className="numeric whitespace-nowrap rounded-[var(--radius-sm)] text-text underline decoration-border-strong underline-offset-4 transition-colors duration-200 ease-[var(--ease-out-quart)] hover:decoration-brand"
              >
                +91 80 4512 7788
              </a>
              .
            </p>
          </div>
        </div>

        {/* Foreground plate. It sits on the floor of the frame, travels fastest
            of the background layers, and carries the four things a customer
            checks before walking over. */}
        <div
          data-hero-band
          className="relative z-10 bg-[color-mix(in_oklab,var(--surface)_80%,transparent)]"
        >
          <div
            data-hero-rule
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px origin-left bg-border"
          />
          <div className="mx-auto w-full max-w-[76rem] px-6 py-8 sm:px-8 lg:py-10">
            <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {COUNTER_FACTS.map((fact) => (
                <div data-hero-fact key={fact.label}>
                  <dt className="text-[0.875rem] text-text-secondary">{fact.label}</dt>
                  <dd
                    className={
                      fact.numeric
                        ? "numeric mt-1.5 text-[0.9375rem] leading-relaxed text-text"
                        : "mt-1.5 text-[0.9375rem] leading-relaxed text-pretty text-text"
                    }
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <HeroGrain />
    </div>
  );
}
