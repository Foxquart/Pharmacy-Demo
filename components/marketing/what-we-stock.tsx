"use client";

import { useRef } from "react";
import {
  Baby,
  Drop,
  Eyedropper,
  FirstAidKit,
  Heartbeat,
  Leaf,
  Pill,
  Plant,
  ShieldPlus,
  Stethoscope,
  Syringe,
  Thermometer,
} from "@phosphor-icons/react";
import { gsap, prefersReducedMotion, useGsap } from "@/components/motion/gsap";
import {
  BentoHueTokens,
  BentoLargeCell,
  BentoSmallCell,
  BentoWideCell,
  type BentoCategory,
} from "./bento-cell";
import { Reveal } from "./reveal";

type CellSize = "large" | "wide" | "small";

interface BentoEntry extends BentoCategory {
  size: CellSize;
  /** Desktop span. Mobile is one column, tablet is two; see the grid below. */
  span: string;
}

/**
 * The twelve racks, in the order they earn their space. Every product named
 * here is genuinely in the seeded catalogue (`lib/domain/seed.ts`), because a
 * list of invented medicines is the fastest way to make a real shop look fake.
 *
 * Desktop is a six-column grid. The four racks the counter actually turns over
 * take 2x2 cells; the rest run as strips and half-width cells. Twelve cells,
 * twelve categories, no filler.
 *
 * `hue` is an OKLCH hue angle and the only colour each rack chooses. The twelve
 * are spread around the wheel with a gap between neighbouring cells, at one
 * fixed chroma, so the grid reads as a family. Surgical is the exception: it
 * drops its chroma so the devices rack reads as steel.
 */
const RACKS: BentoEntry[] = [
  {
    name: "Analgesics",
    size: "large",
    span: "md:col-span-2 lg:col-span-2 lg:row-span-2",
    hue: 40,
    icon: Pill,
    rx: "some",
    blurb:
      "Fever, headaches and the aches that come after a long day on your feet. The rack nearest the counter, because it is the one people ask for most.",
    brands: ["Dolo 650", "Combiflam", "Zerodol SP", "Volini gel"],
  },
  {
    name: "Antibiotics",
    size: "large",
    span: "md:col-span-2 lg:col-span-2 lg:row-span-2",
    hue: 300,
    icon: ShieldPlus,
    rx: "all",
    blurb:
      "The full course, dispensed against a valid prescription and written into the register the same day. Please finish it even once you feel better.",
    brands: ["Augmentin 625 Duo", "Azithral 500", "Ciplox 500", "Metrogyl 400"],
  },
  {
    name: "Cardiac",
    size: "large",
    span: "md:col-span-2 lg:col-span-2 lg:row-span-2",
    hue: 6,
    icon: Heartbeat,
    rx: "all",
    blurb:
      "Blood pressure, blood thinners and cholesterol. We keep the strips our regulars refill every month, so a repeat is never a wasted trip.",
    brands: ["Telma 40", "Ecosprin 75", "Rosuvas 10", "Clopitab 75"],
  },
  {
    name: "Diabetes care",
    size: "large",
    span: "md:col-span-2 lg:col-span-2 lg:row-span-2",
    hue: 252,
    icon: Syringe,
    rx: "some",
    blurb:
      "Tablets on the shelf, insulin in the fridge, and the strips for the meter at home. Tell us your pen and we will keep it in.",
    brands: ["Glycomet 500", "Glycomet GP 2", "Lantus SoloStar", "Accu-Chek strips"],
  },
  {
    name: "Respiratory",
    size: "wide",
    span: "md:col-span-1 lg:col-span-4",
    hue: 202,
    icon: Stethoscope,
    rx: "some",
    blurb: "Allergies, blocked noses, cold and cough, through the dusty months and the wet ones.",
    brands: ["Montek LC", "Allegra 120", "Cetzine 10", "Otrivin spray"],
  },
  {
    name: "Gastro",
    size: "small",
    span: "md:col-span-1 lg:col-span-2",
    hue: 92,
    icon: Eyedropper,
    rx: "some",
    brands: ["Pan-D", "Omez 20", "Digene gel"],
  },
  {
    name: "Dermatology",
    size: "small",
    span: "md:col-span-1 lg:col-span-2",
    hue: 348,
    icon: Drop,
    rx: "some",
    brands: ["Betadine ointment", "Soframycin cream", "Candid powder"],
  },
  {
    name: "Vitamins & supplements",
    size: "small",
    span: "md:col-span-1 lg:col-span-2",
    hue: 132,
    icon: Leaf,
    rx: "none",
    brands: ["Shelcal 500", "Zincovit", "Neurobion Forte"],
  },
  {
    name: "Baby care",
    size: "small",
    span: "md:col-span-1 lg:col-span-2",
    hue: 55,
    icon: Baby,
    rx: "none",
    brands: ["Cerelac Stage 1", "Himalaya baby soap", "Colicaid drops"],
  },
  {
    name: "First aid",
    size: "small",
    span: "md:col-span-1 lg:col-span-2",
    hue: 22,
    icon: FirstAidKit,
    rx: "none",
    brands: ["Dettol", "Hansaplast", "Burnol", "Electral ORS"],
  },
  {
    name: "Surgical & devices",
    size: "wide",
    span: "md:col-span-1 lg:col-span-3",
    hue: 268,
    chroma: 0.4,
    icon: Thermometer,
    rx: "none",
    blurb: "Monitors, dressings and disposables, for looking after someone at home.",
    brands: ["Omron BP monitor", "Digital thermometer", "Dispovan syringes"],
  },
  {
    name: "Ayurvedic",
    size: "wide",
    span: "md:col-span-1 lg:col-span-3",
    hue: 158,
    icon: Plant,
    rx: "none",
    blurb: "The household names, kept on the shelf beside everything else.",
    brands: ["Liv.52 DS", "Septilin", "Zandu Balm"],
  },
];

export function WhatWeStock() {
  const gridRef = useRef<HTMLUListElement>(null);

  /**
   * The grid arrives as a wave. `distribute` with `grid: "auto"` reads the laid
   * out positions, so the delay runs diagonally from the top left rather than
   * down a DOM list, which is what makes an asymmetric bento read as a layout
   * instead of a column. Roughly 55ms a cell.
   *
   * Nothing is hidden in CSS: the cells render settled, and only this timeline
   * hides them, one frame before paint. Under reduced motion it never runs, so
   * the grid is simply there.
   */
  const scope = useGsap(() => {
    if (prefersReducedMotion()) return;

    const grid = gridRef.current;
    if (!grid) return;

    const cells = gsap.utils.toArray<HTMLElement>("[data-bento-cell]", grid);
    if (cells.length === 0) return;

    gsap.set(cells, { opacity: 0, y: 26 });
    gsap.to(cells, {
      opacity: 1,
      y: 0,
      duration: 0.72,
      ease: "power3.out",
      stagger: gsap.utils.distribute({ amount: 0.62, from: "start", grid: "auto" }),
      clearProps: "transform,opacity",
      scrollTrigger: {
        trigger: grid,
        start: "top 82%",
        once: true,
      },
    });
  }, []);

  return (
    <section id="stock" className="border-b border-border bg-surface">
      <BentoHueTokens />

      <div ref={scope} className="mx-auto w-full max-w-[76rem] px-6 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 className="text-[clamp(1.875rem,4vw,2.75rem)] font-light leading-[1.1] tracking-[-0.018em] text-balance text-text">
                What we keep on the shelves
              </h2>
            </Reveal>
            <Reveal delay={70}>
              <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-pretty text-text-secondary">
                Twelve racks, restocked through the week. These are the names people actually ask
                for at the counter.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} className="lg:col-span-7 lg:pt-3">
            <p className="max-w-[54ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary">
              Anything marked prescription only is dispensed against a valid prescription, and we
              record what goes out against it, as the rules require. The original goes home with
              you. Everything else you can simply pick up, and the pharmacist is on the counter if
              you want to check first.
            </p>
          </Reveal>
        </div>

        {/* Mobile is a strict single column, tablet is two columns with the four
            big racks running full width, desktop is the six-column bento. */}
        <ul
          ref={gridRef}
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-14 lg:auto-rows-[minmax(9.5rem,auto)] lg:grid-cols-6"
        >
          {RACKS.map((rack) => {
            if (rack.size === "large") {
              return <BentoLargeCell key={rack.name} category={rack} className={rack.span} />;
            }
            if (rack.size === "wide") {
              return <BentoWideCell key={rack.name} category={rack} className={rack.span} />;
            }
            return <BentoSmallCell key={rack.name} category={rack} className={rack.span} />;
          })}
        </ul>

        <p className="mt-10 max-w-[58ch] text-[0.9375rem] leading-relaxed text-pretty text-text-secondary">
          Not seeing what you need? Ask at the counter. If we do not have it in, we can usually get
          it from the distributor by the next morning.
        </p>
      </div>
    </section>
  );
}
