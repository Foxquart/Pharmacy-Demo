import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Enquire about a site like this",
  description:
    "Meridian Pharmacy is a demo storefront built by Foxquart. Tell us what you want built and we will reply within a working day.",
  alternates: { canonical: "/contact" },
};

/** What actually happens after the form is sent. Stated plainly, because
 *  "we will be in touch" tells a visitor nothing they can plan around. */
const WHAT_HAPPENS = [
  {
    step: "01",
    title: "A person reads it",
    body: "Your message lands in the Foxquart inbox. No ticket queue, no autoresponder chain.",
  },
  {
    step: "02",
    title: "We reply within a working day",
    body: "To the address you give us, at the time of day you picked, in your own timezone.",
  },
  {
    step: "03",
    title: "You see it running on your own data",
    body: "If it is a fit, we load a slice of your real catalogue into a demo so you judge it on your numbers, not ours.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-[76rem] px-6 pb-24 pt-14 sm:px-8 lg:pt-20">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        {/* Left rail: context. Narrower than the form, so the form reads as the task. */}
        <div className="lg:col-span-5">
          <h1 className="text-[clamp(2.5rem,6vw,3.75rem)] font-light leading-[1.04] tracking-[-0.018em] text-text text-balance">
            Want one of these?
          </h1>
          <p className="mt-5 max-w-[44ch] text-[1.0625rem] leading-relaxed text-text-secondary text-pretty">
            Meridian Pharmacy is a demo storefront, built end to end by Foxquart. Tell us what you
            need and we answer every message ourselves.
          </p>
          <p className="mt-4 max-w-[44ch] text-[0.875rem] leading-relaxed text-text-tertiary text-pretty">
            Looking for the pharmacy itself? Its counter is on{" "}
            <a
              href="tel:+918045127788"
              className="numeric font-normal text-brand-text underline-offset-4 hover:underline"
            >
              +91 80 4512 7788
            </a>
            .
          </p>

          <ol className="mt-12 space-y-8">
            {WHAT_HAPPENS.map((item) => (
              <li key={item.step} className="flex gap-5">
                <span
                  className="numeric mt-0.5 shrink-0 text-[0.75rem] font-normal text-text-tertiary"
                  aria-hidden="true"
                >
                  {item.step}
                </span>
                <div>
                  <h2 className="text-[0.9375rem] font-normal tracking-[-0.01em] text-text">
                    {item.title}
                  </h2>
                  <p className="mt-1.5 max-w-[40ch] text-[0.875rem] leading-relaxed text-text-secondary">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex items-center gap-3 border-t border-border pt-8">
            <Image
              src="/brand/foxquart-logo.svg"
              alt=""
              width={26}
              height={26}
              className="rounded-[var(--radius-sm)]"
            />
            <p className="text-[0.8125rem] leading-relaxed text-text-secondary">
              Built and maintained by{" "}
              <a
                href="https://foxquart.com"
                className="font-normal text-foxquart underline-offset-4 transition-colors duration-200 ease-[var(--ease-out-quart)] hover:underline"
              >
                Foxquart
              </a>
              .
            </p>
          </div>
        </div>

        {/* Right: the form itself, on a raised surface so it reads as the one thing to do. */}
        <div className="lg:col-span-7">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-xs sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
