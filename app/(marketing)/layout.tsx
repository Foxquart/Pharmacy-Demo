import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IntroLoader } from "@/components/marketing/intro-loader";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export const metadata: Metadata = {
  title: {
    absolute: "Meridian Pharmacy: chemist on 100 Feet Road, Indiranagar",
  },
  description:
    "Neighbourhood chemist in HAL 2nd Stage, Indiranagar, Bengaluru. Prescriptions, everyday medicines, baby care and first aid. Open 8:30 am to 10:30 pm, free local delivery.",
  openGraph: {
    type: "website",
    title: "Meridian Pharmacy: chemist on 100 Feet Road, Indiranagar",
    description:
      "Prescriptions, everyday medicines and first aid at No. 42, 4th Cross, 100 Feet Road. A registered pharmacist on the counter every hour we are open.",
  },
  alternates: { canonical: "/" },
};

/**
 * The storefront runs at the page-level motion budget: Lenis carries the scroll
 * so every ScrollTrigger on the page shares one frame, and the intro loader
 * plays its opening shot once per session.
 *
 * Order matters. `IntroLoader` is mounted before the page chrome and renders an
 * inline boot script that stamps <html> during HTML parse, so a returning or
 * reduced-motion visitor never sees a frame of it. The page itself is a
 * complete, ordinary document underneath the whole time; nothing below waits on
 * the loader to render, so the hero is the LCP candidate either way.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <IntroLoader />
      <div className="flex min-h-dvh flex-col bg-bg">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
