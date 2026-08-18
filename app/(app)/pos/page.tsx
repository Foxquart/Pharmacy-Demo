import type { Metadata } from "next";

import { PosScreen } from "@/components/pos/pos-screen";

export const metadata: Metadata = {
  title: "Counter",
  description:
    "Scan, bill and collect at the pharmacy counter. Batch-level FEFO picking, prescription gating and UPI settlement that commits its own stock.",
};

export default function PosPage() {
  return <PosScreen />;
}
