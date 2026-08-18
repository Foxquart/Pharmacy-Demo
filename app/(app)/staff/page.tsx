import type { Metadata } from "next";
import { StaffManager } from "@/components/app/staff-manager";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return <StaffManager />;
}
