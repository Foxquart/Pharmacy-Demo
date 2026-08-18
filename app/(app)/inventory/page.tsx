import type { Metadata } from "next";

import { InventoryView } from "@/components/inventory/inventory-view";

export const metadata: Metadata = {
  title: "Inventory",
  description:
    "Batch-level stock, expiry and reorder state for every SKU on the shelf.",
};

export default function InventoryPage() {
  return <InventoryView />;
}
