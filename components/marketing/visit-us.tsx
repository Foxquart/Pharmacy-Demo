"use client";

import { useEffect, useState } from "react";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/** The same two rows the open/closed signal is computed from. */
const HOURS = [
  { day: "Monday", time: "8:30 am to 10:30 pm" },
  { day: "Tuesday", time: "8:30 am to 10:30 pm" },
  { day: "Wednesday", time: "8:30 am to 10:30 pm" },
  { day: "Thursday", time: "8:30 am to 10:30 pm" },
  { day: "Friday", time: "8:30 am to 10:30 pm" },
  { day: "Saturday", time: "8:30 am to 10:30 pm" },
  { day: "Sunday", time: "9:00 am to 9:00 pm" },
];

const ADDRESS_LINES = [
  { text: "No. 42, 4th Cross", strong: true },
  { text: "100 Feet Road", strong: true },
  { text: "HAL 2nd Stage, Indiranagar", strong: false },
  { text: "Bengaluru, Karnataka 560038", strong: false },
];

/**
 * Where the shop is, how to reach it, and when the shutter is up.
 *
 * The week reveals row by row on a scrubbed timeline, so the reader arrives at
 * the day they care about rather than at a block of seven identical lines. The
 * current day is resolved against Asia/Kolkata on the client, and is marked
 * with a word as well as a ground, never colour on its own.
 */
export function VisitUs() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setToday(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
        }).format(new Date()),
      );
    read();
    const timer = window.setInterval(read, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const scope = useGsap(() => {
    // Reduced motion: nothing is hidden to begin with, so skipping every
    // timeline leaves the section fully rendered and reachable.
    if (prefersReducedMotion()) return;

    const lines = gsap.utils.toArray<HTMLElement>("[data-line]");
    lines.forEach((line) => {
      gsap.from(line, {
        yPercent: 118,
        duration: 1.1,
        ease: "expo.out",
        scrollTrigger: { trigger: line.parentElement ?? line, start: "top 88%" },
      });
    });

    const details = gsap.utils.toArray<HTMLElement>("[data-detail]");
    gsap.from(details, {
      y: 18,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: details[0], start: "top 90%" },
    });

    // The week, scrubbed. Each row is its own mask, so the day and the hours
    // rise together out of the rule above them.
    const rows = gsap.utils.toArray<HTMLElement>("[data-hours-row]");
    const table = document.querySelector("[data-hours]");
    if (rows.length && table) {
      const week = gsap.timeline({
        scrollTrigger: {
          trigger: table,
          start: "top 85%",
          end: "bottom 72%",
          scrub: 0.5,
        },
      });
      rows.forEach((row, index) => {
        week.from(
          Array.from(row.children),
          { yPercent: 135, opacity: 0, duration: 0.7, ease: "none" },
          index * 0.42,
        );
      });
    }

    const aura = document.querySelector("[data-aura]");
    if (aura) {
      gsap.fromTo(
        aura,
        { yPercent: -6 },
        {
          yPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: "#visit", start: "top bottom", end: "bottom top", scrub: 1 },
        },
      );
    }
  }, []);

  return (
    <section
      id="visit"
      ref={scope}
      className="relative overflow-clip border-b border-border bg-bg-sunken"
    >
      <div
        aria-hidden
        data-aura
        className="pointer-events-none absolute inset-x-0 -top-32 h-[42rem] will-change-transform"
        style={{
          background:
            "radial-gradient(52% 58% at 20% 0%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 72%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[76rem] px-6 py-20 sm:px-8 lg:py-32">
        <header className="max-w-[46rem]">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.04] tracking-[-0.018em] text-text">
            <span className="block overflow-hidden pb-[0.14em] -mb-[0.14em]">
              <span data-line className="block">
                Visit us
              </span>
            </span>
          </h2>
          <p className="mt-5 max-w-[48ch] text-[1.0625rem] leading-relaxed text-pretty text-text-secondary">
            We are the ground floor corner shop where the 4th Cross meets 100 Feet Road. Call ahead
            and we will keep it ready at the counter with your name on it.
          </p>
        </header>

        <div className="mt-16 grid gap-14 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          {/* The address, at the size a shop sign deserves. */}
          <div className="lg:col-span-6 motion-safe:lg:sticky motion-safe:lg:top-28 motion-safe:lg:self-start">
            <h3 className="text-[0.9375rem] font-normal text-text">
              The shop
            </h3>
            <address className="mt-5 text-[clamp(1.5rem,3.2vw,2.375rem)] leading-[1.14] font-light tracking-[-0.018em] not-italic">
              {ADDRESS_LINES.map((line) => (
                <span
                  key={line.text}
                  className="block overflow-hidden pb-[0.1em] -mb-[0.1em]"
                >
                  <span
                    data-line
                    className={cn("block", line.strong ? "text-text" : "text-text-secondary")}
                  >
                    {line.text}
                  </span>
                </span>
              ))}
            </address>

            <p
              data-detail
              className="mt-7 max-w-[44ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary"
            >
              Ten minutes on foot from Indiranagar metro. Come out onto 100 Feet Road, walk towards
              HAL 2nd Stage and turn at the 4th Cross signal. Two-wheeler parking in front, and a
              ramp at the door.
            </p>

            <div data-detail className="mt-10 border-t border-border pt-8">
              <h3 className="text-[0.9375rem] font-normal text-text">
                Reach the counter
              </h3>
              <a
                href="tel:+918045127788"
                className="numeric mt-3 block text-[clamp(1.75rem,5.5vw,2.5rem)] leading-tight font-light tracking-[-0.018em] text-brand-text transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-brand-hover"
              >
                +91 80 4512 7788
              </a>
              <a
                href="mailto:counter@meridianpharmacy.in"
                className="mt-2 block w-fit text-[0.9375rem] text-text-secondary transition-colors duration-200 ease-[var(--ease-out-quart)] hover:text-text"
              >
                counter@meridianpharmacy.in
              </a>
              <a
                href="tel:+918045127788"
                className="mt-7 flex h-13 w-full items-center justify-center rounded-[var(--radius-md)] bg-brand px-7 text-[1rem] font-medium text-on-brand shadow-sm transition-[background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:bg-brand-hover active:scale-[0.99] sm:h-12 sm:w-fit"
              >
                Call the counter
              </a>
            </div>
          </div>

          {/* The week, and the two practical things people ask on the phone. */}
          <div className="lg:col-span-6">
            <div
              data-hours
              className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm"
            >
              <h3 className="border-b border-border px-5 py-4 text-[0.9375rem] font-normal text-text sm:px-6">
                Opening hours
              </h3>
              <dl>
                {HOURS.map((row) => {
                  const isToday = today === row.day;
                  return (
                    <div
                      key={row.day}
                      data-hours-row
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "flex items-baseline justify-between gap-4 overflow-hidden border-b border-border px-5 py-3.5 last:border-b-0 sm:px-6",
                        isToday && "bg-brand-subtle",
                      )}
                    >
                      <dt
                        className={cn(
                          "flex items-baseline gap-2.5 text-[0.9375rem]",
                          isToday ? "font-medium text-text" : "text-text-secondary",
                        )}
                      >
                        {row.day}
                        {isToday ? (
                          <span className="rounded-full border border-brand-border px-2 py-0.5 text-[0.75rem] font-medium text-brand-text">
                            Today
                          </span>
                        ) : null}
                      </dt>
                      <dd
                        className={cn(
                          "numeric text-[0.9375rem]",
                          isToday ? "font-medium text-text" : "text-text-secondary",
                        )}
                      >
                        {row.time}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
            <p data-detail className="mt-4 text-[0.8125rem] leading-relaxed text-text-tertiary">
              Open on public holidays. We close only on the two days a year the shop is
              stock-checked, and we put a notice on the shutter a week before.
            </p>

            <div data-detail className="mt-10 border-t border-border pt-8">
              <h3 className="text-[0.9375rem] font-normal text-text">
                Delivery and payment
              </h3>
              <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary">
                Free delivery in Indiranagar, HAL 2nd Stage and Domlur on orders over{" "}
                <span className="numeric">₹300</span>. Order by phone before{" "}
                <span className="numeric">9:00 pm</span> and it reaches you the same evening. Send
                the prescription photo to the same number and we will read it back to you before we
                pack.
              </p>
              <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary">
                Cash, card and UPI at the counter, and UPI on delivery.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
