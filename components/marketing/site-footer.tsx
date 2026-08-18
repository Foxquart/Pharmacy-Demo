"use client";

import Link from "next/link";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";

const SECTIONS = [
  { href: "/#stock", label: "What we stock" },
  { href: "/#visit", label: "Visit us" },
  { href: "/#trust", label: "Why people trust us" },
];

/**
 * The quiet end of the page: the shop's own details, the way in for staff, the
 * studio lockup, and the legal note. The legal note is plain Lexend at reading
 * size, sentence case, normal tracking. It is a legal statement, not decoration.
 */
export function SiteFooter() {
  const scope = useGsap(() => {
    if (prefersReducedMotion()) return;

    const wordmark = document.querySelector("[data-footer-line]");
    if (wordmark) {
      gsap.from(wordmark, {
        yPercent: 118,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: { trigger: "[data-footer]", start: "top 92%" },
      });
    }

    const columns = gsap.utils.toArray<HTMLElement>("[data-footer-col]");
    gsap.from(columns, {
      y: 18,
      opacity: 0,
      duration: 0.85,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: "[data-footer]", start: "top 90%" },
    });
  }, []);

  return (
    <footer ref={scope} className="border-t border-border bg-bg">
      <div
        data-footer
        className="mx-auto grid w-full max-w-[76rem] gap-10 px-6 py-16 sm:px-8 md:grid-cols-12 md:gap-8"
      >
        <div className="md:col-span-5">
          <p className="text-[clamp(1.375rem,2.6vw,1.875rem)] leading-tight font-light tracking-[-0.018em] text-text">
            <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
              <span data-footer-line className="block">
                Meridian Pharmacy
              </span>
            </span>
          </p>
          <address data-footer-col className="mt-4 max-w-[34ch] text-[0.9375rem] leading-relaxed not-italic text-text-secondary">
            No. 42, 4th Cross, 100 Feet Road
            <br />
            HAL 2nd Stage, Indiranagar
            <br />
            Bengaluru, Karnataka <span className="numeric">560038</span>
          </address>
          <p data-footer-col className="mt-4 text-[0.9375rem] leading-relaxed text-text-secondary">
            <a
              href="tel:+918045127788"
              className="numeric rounded-[var(--radius-sm)] font-medium text-brand-text transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-brand-hover"
            >
              +91 80 4512 7788
            </a>
            <br />
            <a
              href="mailto:counter@meridianpharmacy.in"
              className="rounded-[var(--radius-sm)] transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text"
            >
              counter@meridianpharmacy.in
            </a>
          </p>
        </div>

        <div data-footer-col className="md:col-span-4">
          <p className="text-[0.9375rem] font-normal text-text">Open</p>
          <dl className="mt-3 text-[0.9375rem] leading-relaxed text-text-secondary">
            <dt className="sr-only">Monday to Saturday</dt>
            <dd>
              Monday to Saturday, <span className="numeric">8:30 am to 10:30 pm</span>
            </dd>
            <dt className="sr-only">Sunday</dt>
            <dd className="mt-1">
              Sunday, <span className="numeric">9:00 am to 9:00 pm</span>
            </dd>
          </dl>
          <p className="mt-3 max-w-[32ch] text-[0.875rem] leading-relaxed text-text-tertiary">
            Free delivery in Indiranagar, HAL 2nd Stage and Domlur.
          </p>
        </div>

        <nav
          data-footer-col
          aria-label="Footer"
          className="flex flex-col items-start gap-3 text-[0.9375rem] md:col-span-3"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="rounded-[var(--radius-sm)] text-text-secondary transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text"
            >
              {section.label}
            </a>
          ))}
          <Link
            href="/contact"
            className="rounded-[var(--radius-sm)] font-medium text-brand-text transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-brand-hover"
          >
            Enquire about a site like this
          </Link>
          <Link
            href="/pos"
            className="mt-1 rounded-[var(--radius-sm)] text-[0.8125rem] text-text-tertiary transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text-secondary"
          >
            Staff login
          </Link>
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-4 border-t border-border px-6 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
        <a
          href="https://foxquart.com"
          className="inline-flex shrink-0 items-center gap-2.5 rounded-[var(--radius-sm)] text-[0.875rem] text-text-secondary transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text"
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
        <p className="max-w-[62ch] text-[0.8125rem] leading-relaxed text-text-tertiary">
          Meridian Retail Pharmacy Pvt Ltd. GSTIN{" "}
          <span className="numeric">29AAJCM8821K1ZQ</span>. Drug licences{" "}
          <span className="numeric">KA-B-20/2019-1147</span> and{" "}
          <span className="numeric">KA-B-21/2019-1148</span>. This is a demo storefront, not a real
          shop.
        </p>
      </div>
    </footer>
  );
}
