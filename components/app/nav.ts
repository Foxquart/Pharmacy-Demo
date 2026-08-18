import type { Role } from "@/lib/domain/types";

export interface NavItem {
  href: string;
  label: string;
  /** Phosphor icon name, resolved in the shell so this file stays serialisable. */
  icon: "Storefront" | "Package" | "Receipt" | "ChartBar" | "Gear" | "Users";
  /** Roles that may see the item at all. Hiding is not security here, but it is
   *  the difference between a cashier who can work and one who is lost. */
  roles: Role[];
  shortcut?: string;
}

/**
 * Ordered by how often a counter actually uses them, not by hierarchy.
 * Billing is first because it is where the operator spends the whole shift.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/pos", label: "Counter", icon: "Storefront", roles: ["OWNER", "PHARMACIST", "CASHIER"], shortcut: "g then c" },
  { href: "/inventory", label: "Inventory", icon: "Package", roles: ["OWNER", "PHARMACIST"], shortcut: "g then i" },
  { href: "/payments", label: "Payments", icon: "Receipt", roles: ["OWNER", "PHARMACIST", "CASHIER"], shortcut: "g then p" },
  { href: "/reports", label: "Reports", icon: "ChartBar", roles: ["OWNER", "PHARMACIST"], shortcut: "g then r" },
  { href: "/settings", label: "Settings", icon: "Gear", roles: ["OWNER"], shortcut: "g then s" },
  { href: "/staff", label: "Staff", icon: "Users", roles: ["OWNER"], shortcut: "g then t" },
];

export function navFor(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** What each role is actually allowed to see, stated once so pages agree. */
export const CAN_SEE_COST: Role[] = ["OWNER", "PHARMACIST"];
export const CAN_EDIT_FEES: Role[] = ["OWNER"];
export const CAN_MANAGE_STAFF: Role[] = ["OWNER"];

/**
 * Capability definitions live in `lib/domain/capabilities.ts` so the store and
 * the seed can reach them without importing from the component tree. Re-exported
 * here because that is where UI code already looks.
 */
export {
  CAPABILITIES,
  CAPABILITY_IDS,
  ROLE_ORDER,
  ROLE_LABEL,
  builtInRoles,
  can,
  capabilitiesOf,
  baseRoleFor,
  type Capability,
} from "@/lib/domain/capabilities";
