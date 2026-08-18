"use client";

import { Kbd, KbdGroup } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The full keyboard map, on screen, permanently.
 *
 * A counter tool that hides its shortcuts behind a help modal is a counter tool
 * nobody learns. Every binding this screen listens for is listed here, in the
 * order an operator meets them.
 */
export const POS_SHORTCUTS: ReadonlyArray<{ keys: string[]; label: string }> = [
  { keys: ["F2"], label: "Focus search" },
  { keys: ["↑", "↓"], label: "Move highlight" },
  { keys: ["Enter"], label: "Add highlighted" },
  { keys: ["+", "-"], label: "Line quantity" },
  { keys: ["Delete"], label: "Remove line" },
  { keys: ["F4"], label: "Cash checkout" },
  { keys: ["F8"], label: "UPI checkout" },
  { keys: ["Esc"], label: "Clear or close" },
];

export function KeyboardLegend({ className }: { className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-4 gap-y-1.5", className)}>
      {POS_SHORTCUTS.map((shortcut) => (
        <div key={shortcut.label} className="flex items-center justify-between gap-3">
          <dt className="text-[0.75rem] text-text-secondary">{shortcut.label}</dt>
          <dd>
            <KbdGroup separator={shortcut.keys.length > 1 ? "/" : undefined}>
              {shortcut.keys.map((key) => (
                <Kbd key={key} size="sm">
                  {key}
                </Kbd>
              ))}
            </KbdGroup>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The same map laid out as a single wrapping row, for the top of the screen. */
export function KeyboardStrip({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {POS_SHORTCUTS.map((shortcut) => (
        <li key={shortcut.label} className="flex items-center gap-1.5">
          <KbdGroup separator={shortcut.keys.length > 1 ? "/" : undefined}>
            {shortcut.keys.map((key) => (
              <Kbd key={key} size="sm">
                {key}
              </Kbd>
            ))}
          </KbdGroup>
          <span className="text-[0.75rem] text-text-tertiary">{shortcut.label}</span>
        </li>
      ))}
    </ul>
  );
}
