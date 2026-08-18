"use client";

import { useEffect, useRef } from "react";

/**
 * Captures input from a USB/Bluetooth barcode scanner anywhere on the page.
 *
 * Hardware scanners present as HID keyboards: they "type" the barcode and then
 * send Enter. We tell them apart from a human by cadence — a scanner emits
 * characters roughly every 5-20ms, a person cannot sustain under ~50ms.
 *
 * This matters at a pharmacy counter because the cashier's hands are on the
 * scanner, not the keyboard. Requiring them to click into a search field before
 * every scan is the single biggest source of friction in POS software, so the
 * listener is global and fires no matter what has focus.
 */

export interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  /** Max ms between keystrokes to still count as machine input. */
  maxIntervalMs?: number;
  /** Shorter runs are treated as human typing and discarded. */
  minLength?: number;
  enabled?: boolean;
}

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 35,
  minLength = 6,
  enabled = true,
}: BarcodeScannerOptions) {
  // Held in refs, not state: a scan produces ~13 keystrokes in ~150ms and
  // re-rendering on each one would drop characters.
  const buffer = useRef("");
  const lastKeyAt = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      // A scanner aimed at a real text field should behave like a keyboard.
      // Only intercept when the operator is not deliberately typing somewhere,
      // or when the field has opted in via data-barcode-target.
      const inEditable =
        !!target &&
        (EDITABLE.has(target.tagName) || target.isContentEditable) &&
        target.dataset.barcodeTarget === undefined;
      if (inEditable) return;

      const now = performance.now();
      const gap = now - lastKeyAt.current;
      lastKeyAt.current = now;

      // Too slow to be a machine: this is a person. Start over.
      if (gap > maxIntervalMs && buffer.current.length > 0) {
        buffer.current = "";
      }

      if (event.key === "Enter") {
        const code = buffer.current.trim();
        buffer.current = "";
        if (code.length >= minLength) {
          // Stop the Enter from also submitting whatever form is on screen.
          event.preventDefault();
          event.stopPropagation();
          onScanRef.current(code);
        }
        return;
      }

      // Barcodes are alphanumeric single characters; ignore modifiers and F-keys.
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        buffer.current += event.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, maxIntervalMs, minLength]);
}
