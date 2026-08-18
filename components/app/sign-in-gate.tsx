"use client";

import * as React from "react";
import { Backspace, LockKey } from "@phosphor-icons/react";
import { usePharmacyStore } from "@/lib/store/pharmacy-store";
import { ROLE_LABEL } from "./nav";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 4;
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/**
 * Till hand-over, not account security.
 *
 * A pharmacy counter is one shared screen worked by whoever is standing at it.
 * Asking for an email and password every time the shift changes mid-queue is
 * the kind of friction that gets software abandoned, so identity is a face and
 * four digits: tap your name, tap your PIN, keep serving. Every bill still
 * carries the cashier who rang it.
 */
export function SignInGate() {
  const staff = usePharmacyStore((s) => s.staff);
  const signIn = usePharmacyStore((s) => s.signIn);

  const active = React.useMemo(() => staff.filter((s) => s.isActive), [staff]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState(false);

  const selected = active.find((s) => s.id === selectedId) ?? null;

  const submit = React.useCallback(
    (candidate: string) => {
      if (!selectedId) return;
      if (signIn(selectedId, candidate)) return;
      setError(true);
      // Clear after the shake so the operator sees what was rejected first.
      window.setTimeout(() => {
        setPin("");
        setError(false);
      }, 420);
    },
    [selectedId, signIn],
  );

  const press = React.useCallback(
    (key: string) => {
      if (error) return;
      if (key === "back") {
        setPin((p) => p.slice(0, -1));
        return;
      }
      setPin((p) => {
        if (p.length >= PIN_LENGTH) return p;
        const next = p + key;
        if (next.length === PIN_LENGTH) window.setTimeout(() => submit(next), 90);
        return next;
      });
    },
    [error, submit],
  );

  // The counter has a physical numpad. Typing must work as well as tapping.
  React.useEffect(() => {
    if (!selectedId) return;
    function onKey(event: KeyboardEvent) {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
      else if (event.key === "Escape") {
        setSelectedId(null);
        setPin("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, press]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-sunken px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-[1.5rem] font-light tracking-[-0.018em] text-text">Meridian</h1>
          <p className="mt-1.5 text-[0.875rem] text-text-secondary">
            {selected ? `Enter ${selected.name.split(" ")[0]}'s PIN` : "Who is on the counter?"}
          </p>
        </div>

        {!selected ? (
          <ul className="space-y-2">
            {active.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  className="flex w-full items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5 text-left transition-colors duration-150 ease-[var(--ease-out-quart)] hover:border-border-strong hover:bg-surface-hover"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-subtle text-[0.875rem] font-medium text-brand-text"
                  >
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-text">
                      {member.name}
                    </span>
                    <span className="block text-[0.8125rem] text-text-secondary">
                      {ROLE_LABEL[member.role]}
                    </span>
                  </span>
                  <LockKey size={16} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <div
              className={cn(
                "mb-7 flex justify-center gap-3",
                error && "motion-safe:animate-[ui-shake_400ms_var(--ease-out-quart)]",
              )}
              aria-live="polite"
              aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-3.5 rounded-full border transition-colors duration-150 ease-[var(--ease-out-quart)]",
                    error
                      ? "border-danger bg-danger"
                      : i < pin.length
                        ? "border-brand bg-brand"
                        : "border-border-strong bg-transparent",
                  )}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {KEYPAD.map((key, i) =>
                key === "" ? (
                  <span key={`gap-${i}`} />
                ) : (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    aria-label={key === "back" ? "Delete last digit" : `Digit ${key}`}
                    className="numeric grid h-14 place-items-center rounded-[var(--radius-md)] border border-border bg-surface text-[1.125rem] font-medium text-text transition-[background-color,transform] duration-100 ease-[var(--ease-out-quart)] hover:bg-surface-hover active:scale-[0.97] active:bg-surface-active"
                  >
                    {key === "back" ? (
                      <Backspace size={19} aria-hidden="true" />
                    ) : (
                      key
                    )}
                  </button>
                ),
              )}
            </div>

            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="mt-4"
              onClick={() => {
                setSelectedId(null);
                setPin("");
              }}
            >
              Someone else
            </Button>
          </div>
        )}

        <p className="mt-10 text-center text-[0.75rem] leading-relaxed text-text-tertiary">
          Demo PINs: Ravi 4417 · Ananya 2938 · Kiran 1075 · Farhan 6602
        </p>
      </div>
    </div>
  );
}
