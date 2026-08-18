import type { CapabilityId, CustomRole, Role, Staff } from "./types";

/**
 * The capability catalogue.
 *
 * Written out in full rather than inferred from route names, so an owner can
 * read exactly what handing over a PIN grants. Every gate in the product
 * resolves back to one of these ids, and a custom role is nothing more than a
 * chosen subset of them.
 */
export interface Capability {
  id: CapabilityId;
  label: string;
  detail: string;
  /** Turning this on for a role has real consequences worth spelling out. */
  sensitive?: boolean;
}

export const CAPABILITIES: Capability[] = [
  { id: "pos.bill", label: "Ring up sales", detail: "Scan, build a bill, take cash or show a UPI QR." },
  {
    id: "bill.cancel",
    label: "Cancel a settled bill",
    detail: "Reverses the sale and returns the stock to its batch.",
    sensitive: true,
  },
  { id: "inventory.view", label: "See stock and expiry", detail: "Batch quantities, expiry dates and the movement ledger." },
  { id: "inventory.edit", label: "Receive and adjust stock", detail: "Add medicines and batches, correct counts, write off expired lots." },
  {
    id: "costs.view",
    label: "See cost price and margin",
    detail: "What the shop paid, and what it makes on each line.",
    sensitive: true,
  },
  { id: "reports.view", label: "Read reports", detail: "Sales, top sellers, reorder list and expiry exposure." },
  {
    id: "settings.edit",
    label: "Change shop settings",
    detail: "Shop details, invoice numbering, and the payment fee policy.",
    sensitive: true,
  },
  {
    id: "staff.manage",
    label: "Manage staff and roles",
    detail: "Add people, set PINs, create roles, deactivate accounts.",
    sensitive: true,
  },
];

export const CAPABILITY_IDS: CapabilityId[] = CAPABILITIES.map((c) => c.id);

export const ROLE_ORDER: Role[] = ["OWNER", "PHARMACIST", "CASHIER"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  PHARMACIST: "Pharmacist",
  CASHIER: "Cashier",
};

const BUILT_IN_GRANTS: Record<Role, CapabilityId[]> = {
  OWNER: CAPABILITY_IDS,
  PHARMACIST: ["pos.bill", "bill.cancel", "inventory.view", "inventory.edit", "costs.view", "reports.view"],
  CASHIER: ["pos.bill"],
};

/**
 * The three shipped roles, expressed as ordinary role records so the editor can
 * treat them uniformly. They are locked: an owner may clone one, but editing
 * the built-ins would let someone quietly remove `staff.manage` from Owner and
 * lock the whole shop out.
 */
export function builtInRoles(): CustomRole[] {
  return [
    {
      id: "role_owner",
      name: "Owner",
      description: "Full access, including money settings and staff.",
      capabilities: [...BUILT_IN_GRANTS.OWNER],
      baseRole: "OWNER",
      tone: "brand",
      isBuiltIn: true,
    },
    {
      id: "role_pharmacist",
      name: "Pharmacist",
      description: "Runs the counter and the stock room. No settings or staff.",
      capabilities: [...BUILT_IN_GRANTS.PHARMACIST],
      baseRole: "PHARMACIST",
      tone: "accent",
      isBuiltIn: true,
    },
    {
      id: "role_cashier",
      name: "Cashier",
      description: "Bills and takes payment. Never sees cost price or margin.",
      capabilities: [...BUILT_IN_GRANTS.CASHIER],
      baseRole: "CASHIER",
      tone: "neutral",
      isBuiltIn: true,
    },
  ];
}

/**
 * Resolves what a person may actually do.
 *
 * A custom role wins when one is assigned; otherwise the built-in grants for
 * `staff.role` apply. Keeping `Staff.role` populated either way means the
 * coarse role checks scattered through the product keep working unchanged,
 * while capability checks get the fine-grained answer.
 */
export function can(
  staff: Staff | null | undefined,
  capability: CapabilityId,
  roles?: CustomRole[],
): boolean {
  if (!staff || !staff.isActive) return false;

  if (staff.roleId && roles) {
    const assigned = roles.find((r) => r.id === staff.roleId);
    if (assigned) return assigned.capabilities.includes(capability);
  }
  return BUILT_IN_GRANTS[staff.role].includes(capability);
}

/** The capability set a role grants, for display. */
export function capabilitiesOf(staff: Staff, roles: CustomRole[]): CapabilityId[] {
  const assigned = staff.roleId ? roles.find((r) => r.id === staff.roleId) : undefined;
  return assigned ? assigned.capabilities : BUILT_IN_GRANTS[staff.role];
}

/**
 * The base role a capability set most closely corresponds to. Used to keep
 * `Staff.role` meaningful when a custom role is assigned, so nav gating and the
 * cost-price guard behave sensibly without every call site learning about
 * custom roles.
 */
export function baseRoleFor(capabilities: CapabilityId[]): Role {
  if (capabilities.includes("staff.manage") || capabilities.includes("settings.edit")) return "OWNER";
  if (capabilities.includes("costs.view") || capabilities.includes("inventory.edit")) return "PHARMACIST";
  return "CASHIER";
}
