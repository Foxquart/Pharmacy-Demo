"use client";

import * as React from "react";
import Link from "next/link";
import { Check, PencilSimple, Plus, Prohibit, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { usePharmacyStore, useCurrentStaff, useHydrated } from "@/lib/store/pharmacy-store";
import type { Staff } from "@/lib/domain/types";
import { ROLE_LABEL } from "./nav";
import { RoleEditor } from "./role-editor";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectField,
  SelectItem,
  SelectValue,
  SkeletonRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const TONES = ["brand", "success", "warning", "danger", "accent", "neutral"] as const;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function blankStaff(): Staff {
  return {
    id: `stf_${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    email: "",
    pin: "",
    role: "CASHIER",
    isActive: true,
    avatarTone: TONES[Math.floor(Math.random() * TONES.length)],
  };
}

export function StaffManager() {
  const hydrated = useHydrated();
  const me = useCurrentStaff();
  const staff = usePharmacyStore((s) => s.staff);
  const bills = usePharmacyStore((s) => s.bills);
  const upsertStaff = usePharmacyStore((s) => s.upsertStaff);
  const setStaffActive = usePharmacyStore((s) => s.setStaffActive);
  const removeStaff = usePharmacyStore((s) => s.removeStaff);

  const roles = usePharmacyStore((s) => s.roles);

  const defaultRoleIdFor = React.useCallback(
    (member: Staff) => roles.find((r) => r.isBuiltIn && r.baseRole === member.role)?.id ?? roles[0]?.id ?? "",
    [roles],
  );
  const roleOf = React.useCallback(
    (member: Staff) =>
      roles.find((r) => r.id === member.roleId) ??
      roles.find((r) => r.isBuiltIn && r.baseRole === member.role),
    [roles],
  );
  const roleNameOf = React.useCallback(
    (member: Staff) => roleOf(member)?.name ?? ROLE_LABEL[member.role],
    [roleOf],
  );
  const roleToneOf = React.useCallback(
    (member: Staff) => {
      const tone = roleOf(member)?.tone ?? "neutral";
      return (["brand", "accent", "success", "warning", "danger", "neutral"].includes(tone)
        ? tone
        : "neutral") as "brand" | "accent" | "success" | "warning" | "danger" | "neutral";
    },
    [roleOf],
  );
  const currentCapabilities = React.useCallback(
    (member: Staff) => roleOf(member)?.capabilities ?? [],
    [roleOf],
  );

  const [editing, setEditing] = React.useState<Staff | null>(null);
  const [isNew, setIsNew] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Staff, string>>>({});
  const [confirmRemove, setConfirmRemove] = React.useState<Staff | null>(null);

  if (!hydrated) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} columns={5} />
        ))}
      </div>
    );
  }

  // Not security — the store is client-side and honest about that — but the
  // difference between a cashier who can work and one who is lost.
  if (me?.role !== "OWNER") {
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6">
        <EmptyState
          title="Only the owner manages staff"
          description="Adding people, setting PINs and changing roles are owner tasks. Ask whoever holds the owner PIN."
          action={
            <Button asChild variant="secondary">
              <Link href="/pos">Back to the counter</Link>
            </Button>
          }
        />
      </div>
    );
  }

  function startAdd() {
    setEditing(blankStaff());
    setIsNew(true);
    setErrors({});
  }

  function startEdit(member: Staff) {
    setEditing({ ...member });
    setIsNew(false);
    setErrors({});
  }

  function save() {
    if (!editing) return;
    const next: Partial<Record<keyof Staff, string>> = {};
    if (!editing.name.trim()) next.name = "A name is needed so bills can say who rang them.";
    if (!/^\d{4}$/.test(editing.pin)) next.pin = "Exactly four digits.";
    if (editing.email && !/^\S+@\S+\.\S+$/.test(editing.email)) next.email = "That is not an email address.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    const result = upsertStaff({ ...editing, name: editing.name.trim() });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(isNew ? `${editing.name.trim()} can now sign in` : "Saved");
    setEditing(null);
  }

  function toggleActive(member: Staff) {
    const result = setStaffActive(member.id, !member.isActive);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(member.isActive ? `${member.name} deactivated` : `${member.name} reactivated`);
  }

  function doRemove(member: Staff) {
    const result = removeStaff(member.id);
    setConfirmRemove(null);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(`${member.name} removed`);
  }

  const billCount = (id: string) => bills.filter((b) => b.cashierId === id).length;

  return (
    <div className="mx-auto w-full max-w-[64rem] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.375rem] font-light tracking-[-0.018em] text-text">Staff</h1>
          <p className="mt-1 max-w-[56ch] text-[0.875rem] leading-relaxed text-text-secondary">
            Everyone who can sign in at the counter. A four digit PIN is how the till changes hands
            mid shift, and every bill keeps the name of whoever rang it.
          </p>
        </div>
        <Button
          className="max-lg:h-11"
          leftIcon={<Plus size={16} weight="bold" />}
          onClick={startAdd}
        >
          Add someone
        </Button>
      </div>

      {/* Below `md` each person is a card: six columns of name, role, PIN,
          counts and three icon buttons cannot be read or tapped at 360px. */}
      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface md:hidden">
        {staff.map((member) => (
          <li key={member.id} className={cn("px-3 py-3", !member.isActive && "opacity-60")}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-subtle text-[0.8125rem] font-medium text-brand-text"
              >
                {initials(member.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] leading-tight font-medium text-text">
                  {member.name}
                  {member.id === me.id ? (
                    <span className="ml-1.5 text-[0.75rem] font-normal text-text-tertiary">you</span>
                  ) : null}
                </p>
                {member.email ? (
                  <p className="truncate text-[0.75rem] text-text-tertiary">{member.email}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={roleToneOf(member)}>{roleNameOf(member)}</Badge>
                  {member.isActive ? (
                    <Badge tone="success" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[0.75rem] text-text-secondary">
                  PIN <span className="numeric text-text">{member.pin}</span> ·{" "}
                  <span className="numeric">{billCount(member.id)}</span> bills rung
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1">
              <Button
                variant="secondary"
                className="h-11 flex-1"
                leftIcon={<PencilSimple size={15} />}
                onClick={() => startEdit(member)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={
                  member.isActive ? `Deactivate ${member.name}` : `Reactivate ${member.name}`
                }
                onClick={() => toggleActive(member)}
              >
                {member.isActive ? <Prohibit size={17} /> : <Check size={17} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Remove ${member.name}`}
                onClick={() => setConfirmRemove(member)}
              >
                <Trash size={17} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead numeric>Bills rung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.id} className={cn(!member.isActive && "opacity-60")}>
                <TableCell>
                  <div className="flex items-center gap-2.5 py-1">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-subtle text-[0.6875rem] font-medium text-brand-text"
                    >
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[0.875rem] font-medium text-text">
                        {member.name}
                        {member.id === me.id ? (
                          <span className="ml-1.5 text-[0.75rem] font-normal text-text-tertiary">
                            you
                          </span>
                        ) : null}
                      </div>
                      {member.email ? (
                        <div className="truncate text-[0.75rem] text-text-tertiary">{member.email}</div>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge tone={roleToneOf(member)}>{roleNameOf(member)}</Badge>
                </TableCell>
                <TableCell className="numeric text-text-secondary">{member.pin}</TableCell>
                <TableCell numeric className="text-text-secondary">
                  {billCount(member.id)}
                </TableCell>
                <TableCell>
                  {member.isActive ? (
                    <Badge tone="success" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Edit ${member.name}`} onClick={() => startEdit(member)}>
                          <PencilSimple size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={member.isActive ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}
                          onClick={() => toggleActive(member)}
                        >
                          {member.isActive ? <Prohibit size={16} /> : <Check size={16} />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{member.isActive ? "Deactivate" : "Reactivate"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => setConfirmRemove(member)}
                        >
                          <Trash size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RoleEditor />

      {/* Add / edit */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add someone to the counter" : "Edit staff member"}</DialogTitle>
            <DialogDescription>
              They sign in by tapping their name and entering this PIN.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <DialogBody className="space-y-4">
              <Field label="Full name" htmlFor="staff-name" required errorText={errors.name}>
                <Input
                  id="staff-name"
                  value={editing.name}
                  error={Boolean(errors.name)}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>

              <Field label="Email" htmlFor="staff-email" hint="optional" errorText={errors.email}>
                <Input
                  id="staff-email"
                  type="email"
                  value={editing.email}
                  error={Boolean(errors.email)}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </Field>

              <Select
                value={editing.roleId ?? defaultRoleIdFor(editing)}
                onValueChange={(roleId) => {
                  const role = roles.find((r) => r.id === roleId);
                  if (!role) return;
                  // Both are set together: the store keeps `role` as the coarse
                  // fallback that nav gating and the cost guard already read.
                  setEditing({ ...editing, roleId: role.id, role: role.baseRole });
                }}
              >
                <SelectField
                  label="Role"
                  id="staff-role"
                  helperText={
                    roles.find((r) => r.id === (editing.roleId ?? defaultRoleIdFor(editing)))?.description
                  }
                >
                  <SelectValue />
                </SelectField>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Field
                label="Counter PIN"
                htmlFor="staff-pin"
                required
                helperText="Four digits. Must not match anyone else's."
                errorText={errors.pin}
              >
                <Input
                  id="staff-pin"
                  inputMode="numeric"
                  maxLength={4}
                  className="numeric"
                  value={editing.pin}
                  error={Boolean(errors.pin)}
                  onChange={(e) =>
                    setEditing({ ...editing, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                />
              </Field>

              {!currentCapabilities(editing).includes("costs.view") ? (
                <Alert
                  tone="info"
                  description="This role can bill and take payment, but never sees cost price or margin."
                />
              ) : null}
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button
              variant="secondary"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button className="max-sm:h-11 max-sm:flex-1" onClick={save}>
              {isNew ? "Add to counter" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={confirmRemove !== null} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Remove {confirmRemove?.name}?</DialogTitle>
            <DialogDescription>
              They lose counter access immediately. If they have ever rung up a bill this will be
              refused, because those invoices name them as the cashier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => setConfirmRemove(null)}
            >
              Keep them
            </Button>
            <Button
              variant="danger"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => confirmRemove && doRemove(confirmRemove)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
