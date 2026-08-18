"use client";

import Link from "next/link";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";

/**
 * The closing band is the only part of this page that is not the shop talking.
 * It is the studio that built the storefront, said plainly so nobody mistakes
 * the enquiry form for the pharmacy's own phone line.
 *
 * Inverted, full bleed, and given the largest type on the page, because it is
 * the last thing a business owner reads before deciding whether to write in.
 */
export function BuiltByFoxquart() {
  const scope = useGsap(() => {
    // Reduced motion: the band renders in its settled state, nothing travels.
    if (prefersReducedMotion()) return;

    const lines = gsap.utils.toArray<HTMLElement>("[data-line]");
    gsap.from(lines, {
      yPercent: 118,
      duration: 1.15,
      ease: "expo.out",
      stagger: 0.09,
      scrollTrigger: { trigger: "[data-closing]", start: "top 78%" },
    });

    const supporting = gsap.utils.toArray<HTMLElement>("[data-supporting]");
    gsap.from(supporting, {
      y: 24,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      stagger: 0.09,
      scrollTrigger: { trigger: "[data-closing]", start: "top 68%" },
    });

    const rule = document.querySelector("[data-rule]");
    if (rule) {
      gsap.fromTo(
        rule,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          duration: 1.4,
          ease: "expo.out",
          scrollTrigger: { trigger: "[data-closing]", start: "top 76%" },
        },
      );
    }

    const aura = document.querySelector("[data-closing-aura]");
    if (aura) {
      gsap.fromTo(
        aura,
        { yPercent: -10, scale: 1.05 },
        {
          yPercent: 10,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-closing]",
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        },
      );
    }
  }, []);

  return (
    <section ref={scope} className="relative overflow-clip bg-brand text-on-brand">
      <div
        aria-hidden
        data-closing-aura
        className="pointer-events-none absolute inset-0 will-change-transform"
        style={{
          background:
            "radial-gradient(48% 60% at 82% 8%, color-mix(in oklab, var(--on-brand) 16%, transparent), transparent 70%), radial-gradient(42% 55% at 6% 100%, color-mix(in oklab, var(--foxquart) 18%, transparent), transparent 72%)",
        }}
      />

      <div
        data-closing
        className="relative mx-auto w-full max-w-[76rem] px-6 py-24 sm:px-8 lg:py-36"
      >
        <h2 className="text-[clamp(2.25rem,6.5vw,4.5rem)] leading-[1.04] font-light tracking-[-0.018em] text-on-brand">
          <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
            <span data-line className="block">
              Meridian is a demo.
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
            <span data-line className="block text-on-brand/70">
              Foxquart built all of it.
            </span>
          </span>
        </h2>

        <div
          data-rule
          aria-hidden
          className="mt-12 h-px w-full bg-on-brand/25 lg:mt-16"
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <div data-supporting className="lg:col-span-7">
            <p className="max-w-[52ch] text-[1.0625rem] leading-relaxed text-pretty text-on-brand/85">
              There is no real chemist at this address. The storefront you have just read, and the
              counter tool the shop runs behind it, were designed and built end to end by Foxquart.
              If you run a business and want one of your own, tell us what you need and we will come
              back with a plan and a price.
            </p>
            <a
              href="https://foxquart.com"
              className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-bg px-4 py-2.5 text-[0.875rem] text-text-secondary shadow-sm transition-[transform,background-color] duration-200 ease-[var(--ease-out-quart)] hover:bg-surface-hover hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/foxquart-logo.svg"
                alt=""
                width={22}
                height={22}
                className="rounded-[5px]"
              />
              <span>
                Built by <span className="font-medium text-foxquart">Foxquart</span>
              </span>
            </a>
          </div>

          <div data-supporting className="lg:col-span-5 lg:justify-self-end">
            <Link
              href="/contact"
              className="inline-flex h-13 items-center justify-center rounded-[var(--radius-md)] bg-bg px-8 text-[1rem] font-medium text-text shadow-xl transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-surface-hover active:scale-[0.99]"
            >
              Enquire about a site like this
            </Link>
            <p className="mt-4 max-w-[34ch] text-[0.875rem] leading-relaxed text-on-brand/70">
              This goes to Foxquart, not to the pharmacy counter.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
