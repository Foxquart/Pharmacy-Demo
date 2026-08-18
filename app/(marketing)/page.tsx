import { Shopfront } from "@/components/marketing/shopfront";
import { WhatWeStock } from "@/components/marketing/what-we-stock";
import { VisitUs } from "@/components/marketing/visit-us";
import { WhyPeopleTrustUs } from "@/components/marketing/why-people-trust-us";
import { BuiltByFoxquart } from "@/components/marketing/built-by-foxquart";

export default function MarketingPage() {
  return (
    <>
      <Shopfront />
      <WhatWeStock />
      <VisitUs />
      <WhyPeopleTrustUs />
      <BuiltByFoxquart />
    </>
  );
}
