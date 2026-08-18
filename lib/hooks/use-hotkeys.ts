"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard shortcuts for the counter. A pharmacist billing a queue should never
 * need the mouse, so the whole POS is reachable from the keyboard and every
 * shortcut is surfaced in the UI with a <Kbd> hint rather than hidden.
 *
 * Bindings are written like "f2", "mod+k", "shift+delete". "mod" is Cmd on
 * macOS and Ctrl elsewhere.
 */

type Handler = (event: KeyboardEvent) => void;

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function matches(event: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));

  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const wantMod = mods.has("mod");
  const modPressed = isMac ? event.metaKey : event.ctrlKey;

  if (wantMod !== modPressed) return false;
  if (mods.has("shift") !== event.shiftKey) return false;
  if (mods.has("alt") !== event.altKey) return false;
  if (!wantMod && mods.has("ctrl") !== event.ctrlKey) return false;

  return event.key.toLowerCase() === key;
}

export function useHotkeys(
  bindings: Record<string, Handler>,
  options?: { enabled?: boolean; allowInInputs?: string[] },
) {
  const ref = useRef(bindings);
  useEffect(() => {
    ref.current = bindings;
  }, [bindings]);

  const enabled = options?.enabled ?? true;
  const allowInInputs = options?.allowInInputs;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inEditable =
        !!target && (EDITABLE.has(target.tagName) || target.isContentEditable);

      for (const [binding, handler] of Object.entries(ref.current)) {
        if (!matches(event, binding)) continue;
        // Escape and function keys must still work while typing in a field,
        // otherwise the operator gets trapped in an input mid-queue.
        const isEscapeHatch =
          binding === "escape" || /^f\d+$/.test(binding) || allowInInputs?.includes(binding);
        if (inEditable && !isEscapeHatch) continue;

        event.preventDefault();
        handler(event);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, allowInInputs]);
}

/** Renders "⌘K" on macOS and "Ctrl K" elsewhere, so hints match the actual key. */
export function useModLabel(): string {
  const ref = useRef("Ctrl");
  useEffect(() => {
    if (/mac/i.test(navigator.platform)) ref.current = "⌘";
  }, []);
  return ref.current;
}
