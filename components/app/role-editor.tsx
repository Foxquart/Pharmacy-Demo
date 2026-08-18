"use client";

import * as React from "react";
import { Copy, Lock, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";
import { CAPABILITIES } from "@/lib/domain/capabilities";
import type { CapabilityId, CustomRole } from "@/lib/domain/types";
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
  Field,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const TONES = ["brand", "accent", "success", "warning", "neutral"] as const;
type Tone = (typeof TONES)[number];

function blankRole(): CustomRole {
  return {
    id: `role_${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    description: "",
    capabilities: ["pos.bill"],
    baseRole: "CASHIER",
    tone: "neutral",
    isBuiltIn: false,
  };
}

export function RoleEditor() {
  const roles = usePharmacyStore((s) => s.roles);
  const staff = usePharmacyStore((s) => s.staff);
  const upsertRole = usePharmacyStore((s) => s.upsertRole);
  const deleteRole = usePharmacyStore((s) => s.deleteRole);

  const [editing, setEditing] = React.useState<CustomRole | null>(null);
  const [isNew, setIsNew] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<CustomRole | null>(null);

  const holdersOf = React.useCallback(
    (roleId: string) => staff.filter((s) => s.roleId === roleId),
    [staff],
  );

  function startNew() {
    setEditing(blankRole());
    setIsNew(true);
  }

  /** Cloning is how you customise a built-in without being able to break it. */
  function duplicate(role: CustomRole) {
    setEditing({
      ...role,
      id: `role_${Math.random().toString(36).slice(2, 9)}`,
      name: `${role.name} (copy)`,
      isBuiltIn: false,
    });
    setIsNew(true);
  }

  function toggle(capability: CapabilityId) {
    setEditing((role) =>
      role
        ? {
            ...role,
            capabilities: role.capabilities.includes(capability)
              ? role.capabilities.filter((c) => c !== capability)
              : [...role.capabilities, capability],
          }
        : role,
    );
  }

  function save() {
    if (!editing) return;
    const result = upsertRole(editing);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(isNew ? `Role "${editing.name.trim()}" created` : "Role updated");
    setEditing(null);
  }

  function remove(role: CustomRole) {
    const result = deleteRole(role.id);
    setConfirmDelete(null);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(`Role "${role.name}" deleted`);
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1rem] font-medium tracking-[-0.02em] text-text">Roles</h2>
          <p className="mt-1 max-w-[60ch] text-[0.875rem] leading-relaxed text-text-secondary">
            A role is a named set of permissions. Build your own for a night shift, a trainee or a
            stock manager. The three shipped roles are locked, but you can duplicate any of them and
            adjust the copy.
          </p>
        </div>
        <Button
          variant="secondary"
          className="max-lg:h-11"
          leftIcon={<Plus size={16} weight="bold" />}
          onClick={startNew}
        >
          New role
        </Button>
      </div>

      {/* Capability matrix. Roles are columns so adding one extends the table
          sideways and the comparison stays readable. */}
      {/* A permission matrix is wide by nature. It scrolls inside this box and
          never takes the page sideways with it. */}
      <div className="mt-5 max-w-full overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bg-sunken">
              <th scope="col" className="px-3 py-2.5 text-[0.75rem] font-medium text-text-secondary">
                Capability
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  scope="col"
                  className="w-[8.5rem] px-3 py-2.5 text-center text-[0.75rem] font-medium text-text-secondary"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Badge tone={(TONES as readonly string[]).includes(role.tone) ? (role.tone as Tone) : "neutral"}>
                      {role.name}
                    </Badge>
                    <div className="flex items-center gap-0.5">
                      {role.isBuiltIn ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="grid size-6 place-items-center text-text-tertiary">
                              <Lock size={12} />
                              <span className="sr-only">Locked built-in role</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Built in, cannot be edited</TooltipContent>
                        </Tooltip>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${role.name}`}
                            onClick={() => {
                              setEditing({ ...role });
                              setIsNew(false);
                            }}
                          >
                            <PencilSimple size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${role.name}`}
                            onClick={() => setConfirmDelete(role)}
                          >
                            <Trash size={13} />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Duplicate ${role.name}`}
                        onClick={() => duplicate(role)}
                      >
                        <Copy size={13} />
                      </Button>
                    </div>
                    <span className="numeric text-[0.6875rem] font-normal text-text-tertiary">
                      {holdersOf(role.id).length || (role.isBuiltIn ? staff.filter((s) => !s.roleId && s.role === role.baseRole).length : 0)} staff
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CAPABILITIES.map((capability) => (
              <tr key={capability.id}>
                <th scope="row" className="px-3 py-2.5 font-normal">
                  <span className="block text-[0.875rem] font-medium text-text">
                    {capability.label}
                  </span>
                  <span className="block text-[0.75rem] leading-relaxed text-text-tertiary">
                    {capability.detail}
                  </span>
                </th>
                {roles.map((role) => {
                  const allowed = role.capabilities.includes(capability.id);
                  return (
                    <td key={role.id} className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-block size-2 rounded-full",
                          allowed ? "bg-success" : "bg-border-strong",
                        )}
                      />
                      <span className="sr-only">
                        {role.name} {allowed ? "can" : "cannot"} {capability.label.toLowerCase()}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / edit */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{isNew ? "New role" : `Edit ${editing?.name}`}</DialogTitle>
            <DialogDescription>
              Tick what this role may do. Anyone already on it picks up the change immediately.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <DialogBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role name" htmlFor="role-name" required>
                  <Input
                    id="role-name"
                    value={editing.name}
                    placeholder="Night shift"
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label="Short description" htmlFor="role-desc" hint="optional">
                  <Input
                    id="role-desc"
                    value={editing.description}
                    placeholder="Bills and checks stock, no money settings"
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="text-[0.8125rem] font-medium text-text">Permissions</legend>
                <div className="mt-2.5 space-y-1.5">
                  {CAPABILITIES.map((capability) => {
                    const checked = editing.capabilities.includes(capability.id);
                    return (
                      <label
                        key={capability.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3",
                          "transition-colors duration-150 ease-[var(--ease-out-quart)]",
                          checked
                            ? "border-brand-border bg-brand-subtle"
                            : "border-border bg-surface hover:bg-surface-hover",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(capability.id)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[0.875rem] font-medium text-text">
                              {capability.label}
                            </span>
                            {capability.sensitive ? (
                              <Badge tone="warning" size="sm">
                                Sensitive
                              </Badge>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-text-secondary">
                            {capability.detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {editing.capabilities.includes("staff.manage") ||
              editing.capabilities.includes("settings.edit") ? (
                <Alert
                  tone="warning"
                  icon={<Warning size={18} weight="fill" />}
                  description="This role can change money settings or hand out PINs. Give it only to people who run the shop."
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
              {isNew ? "Create role" : "Save role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete the {confirmDelete?.name} role?</DialogTitle>
            <DialogDescription>
              Anyone still holding it must be moved to another role first, so nobody is left without
              permissions mid shift.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => setConfirmDelete(null)}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              className="max-sm:h-11 max-sm:flex-1"
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
