"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export interface ThemeToggleProps extends React.ComponentPropsWithoutRef<"button"> {
  /** Turn the tooltip off inside menus, where it would fight the menu itself. */
  withTooltip?: boolean;
}

const BUTTON_CLASS = cn(
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)]",
  "border border-border bg-surface text-text-secondary shadow-xs",
  "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quart)]",
  "hover:border-border-strong hover:bg-surface-hover hover:text-text",
  "active:scale-[0.96] active:bg-surface-active",
);

/** Light is the default and the primary state; dark is the alternate.
 *  Until `next-themes` has read the stored preference on the client we render a
 *  same-sized, icon-less shell — a hydration mismatch on the very first paint of
 *  a POS is a flash of the wrong theme in someone's face at 8am. */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  function ThemeToggle({ className, withTooltip = true, ...props }, ref) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <div
          className={cn(BUTTON_CLASS, "pointer-events-none", className)}
          aria-hidden="true"
        />
      );
    }

    const isDark = resolvedTheme === "dark";
    const next = isDark ? "light" : "dark";
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";

    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={() => setTheme(next)}
        className={cn(BUTTON_CLASS, "relative overflow-hidden", className)}
        {...props}
      >
        {/* Both icons are always mounted and stacked; only opacity and rotation
            change, so the swap reads as one object turning over rather than two
            icons popping in and out. */}
        <Sun
          size={16}
          weight="bold"
          aria-hidden="true"
          className={cn(
            "absolute transition-[opacity,transform] duration-200 ease-[var(--ease-out-quart)]",
            isDark ? "rotate-45 opacity-0" : "rotate-0 opacity-100",
          )}
        />
        <Moon
          size={16}
          weight="bold"
          aria-hidden="true"
          className={cn(
            "absolute transition-[opacity,transform] duration-200 ease-[var(--ease-out-quart)]",
            isDark ? "rotate-0 opacity-100" : "-rotate-45 opacity-0",
          )}
        />
      </button>
    );

    if (!withTooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  },
);
