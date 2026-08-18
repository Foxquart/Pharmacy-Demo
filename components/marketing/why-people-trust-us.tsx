"use client";

import type { ReactNode } from "react";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";

type Commitment = {
  title: string[];
  body: ReactNode;
  facts: { label: string; value: ReactNode }[];
};

const COMMITMENTS: Commitment[] = [
  {
    title: ["A pharmacist is", "on the counter"],
    body: (
      <>
        Every prescription is read and handed over by the pharmacist on duty, every hour the shop is
        open. If the writing is unclear we call the clinic and check rather than guess, and you are
        told how to take it before you leave the counter.
      </>
    ),
    facts: [{ label: "On duty", value: "Every open hour" }],
  },
  {
    title: ["Licensed to", "sell medicine"],
    body: (
      <>
        Karnataka retail drug licences, framed on the wall behind the counter and renewed on time.
        Trading as Meridian Retail Pharmacy Pvt Ltd at this address since{" "}
        <span className="numeric">2019</span>.
      </>
    ),
    facts: [
      { label: "Drug licence", value: <span className="numeric">KA-B-20/2019-1147</span> },
      { label: "Drug licence", value: <span className="numeric">KA-B-21/2019-1148</span> },
    ],
  },
  {
    title: ["Bought only from", "licensed distributors"],
    body: (
      <>
        Every strip on the shelf arrived with a distributor invoice against it. The batch number and
        expiry date are recorded when stock comes in and checked again when it goes out, so we can
        trace any box back to the day it reached us. Nothing within three months of expiry is sold.
      </>
    ),
    facts: [
      { label: "Recorded in", value: "Batch and expiry" },
      { label: "Recorded out", value: "Batch and expiry" },
    ],
  },
  {
    title: ["A cold chain we", "can account for"],
    body: (
      <>
        Insulin and vaccines sit in a monitored fridge from the distributor box to your hand. They
        leave the shop in a cold pack, and we will not send them out into the afternoon heat without
        one.
      </>
    ),
    facts: [
      {
        label: "Fridge held at",
        value: (
          <>
            <span className="numeric">2</span> to <span className="numeric">8</span> degrees
          </>
        ),
      },
    ],
  },
  {
    title: ["A printed GST bill,", "every time"],
    body: (
      <>
        Itemised, with batch and expiry printed on the line and our GSTIN on the foot. It is the
        document your insurer or your employer will ask for. Lost it? We can reprint any bill from
        the counter.
      </>
    ),
    facts: [{ label: "GSTIN", value: <span className="numeric">29AAJCM8821K1ZQ</span> }],
  },
];

/**
 * A sticky stack. Each claim comes to rest under the header and is then taken
 * over by the next one, so the reader finishes a thought before the following
 * card arrives.
 *
 * The two things that make this read correctly:
 *  - the outgoing card is driven by the INCOMING card's trigger, so the handoff
 *    lands exactly when the next card covers it rather than halfway down the
 *    section;
 *  - stickiness itself is behind `motion-safe`, so under reduced motion the
 *    stack is a plain list with no pinning and no scrub at all.
 */
export function WhyPeopleTrustUs() {
  const scope = useGsap(() => {
    if (prefersReducedMotion()) return;

    const lines = gsap.utils.toArray<HTMLElement>("[data-line]");
    lines.forEach((line) => {
      gsap.from(line, {
        yPercent: 118,
        duration: 1.05,
        ease: "expo.out",
        scrollTrigger: { trigger: line.parentElement ?? line, start: "top 90%" },
      });
    });

    const bodies = gsap.utils.toArray<HTMLElement>("[data-card-body]");
    bodies.forEach((body) => {
      gsap.from(body.children, {
        y: 20,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.07,
        scrollTrigger: { trigger: body, start: "top 92%" },
      });
    });

    // The handoff only exists where the cards actually stick.
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]");
      cards.forEach((card, index) => {
        const incoming = cards[index + 1];
        if (!incoming) return;

        // The card keeps its own ground opaque while it recedes, so the card
        // beneath it can never ghost through it. It only gives up its opacity
        // once the incoming card has all but covered it.
        gsap.to(card, {
          scale: 0.94,
          ease: "none",
          transformOrigin: "50% 0%",
          scrollTrigger: { trigger: incoming, start: "top 82%", end: "top 14%", scrub: true },
        });
        gsap.to(card, {
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: incoming, start: "top 44%", end: "top 10%", scrub: true },
        });
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section id="trust" ref={scope} className="relative overflow-clip border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]"
        style={{
          background:
            "radial-gradient(46% 52% at 78% 0%, color-mix(in oklab, var(--brand) 11%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[76rem] px-6 py-20 sm:px-8 lg:py-32">
        <header className="max-w-[46rem]">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.04] tracking-[-0.018em] text-text">
            <span className="block overflow-hidden pb-[0.14em] -mb-[0.14em]">
              <span data-line className="block">
                Why people trust us
              </span>
            </span>
          </h2>
          <p className="mt-5 max-w-[50ch] text-[1.0625rem] leading-relaxed text-pretty text-text-secondary">
            Five things this shop does the same way on a quiet Tuesday morning and on the busiest
            evening of the month.
          </p>
        </header>

        <ol className="mt-16 lg:mt-20">
          {COMMITMENTS.map((item) => (
            <li
              key={item.title.join(" ")}
              className="motion-safe:md:sticky motion-safe:md:top-24 [&+li]:mt-10 md:[&+li]:mt-[14vh]"
            >
              <article
                data-card
                className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-7 shadow-lg will-change-transform sm:p-10 lg:p-12"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, color-mix(in oklab, var(--brand) 55%, transparent), transparent)",
                  }}
                />
                <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
                  <h3
                    className="text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.14] font-light tracking-[-0.018em] text-text lg:col-span-5"
                  >
                    {item.title.map((line) => (
                      <span key={line} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                        <span data-line className="block">
                          {line}
                        </span>
                      </span>
                    ))}
                  </h3>

                  <div data-card-body className="lg:col-span-7">
                    <p className="max-w-[54ch] text-[1.0625rem] leading-relaxed text-pretty text-text-secondary">
                      {item.body}
                    </p>
                    <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
                      {item.facts.map((fact, factIndex) => (
                        <div key={`${fact.label}-${factIndex}`}>
                          <dt className="text-[0.8125rem] text-text-tertiary">{fact.label}</dt>
                          <dd className="mt-1 text-[0.9375rem] font-normal text-text">
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
