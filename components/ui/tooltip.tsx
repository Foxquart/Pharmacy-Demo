"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import "./animations.css";

/** Wrap the app once. 200ms is long enough that tooltips do not flicker as the
 *  pointer crosses a toolbar, short enough to feel like an answer. */
export function TooltipProvider({
  delayDuration = 200,
  skipDelayDuration = 300,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

/** Self-providing root, so a single tooltip works anywhere without ceremony.
 *  Nesting inside an app-level `TooltipProvider` is fine and still groups. */
export function Tooltip({
  delayDuration = 200,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />
    </TooltipPrimitive.Provider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { arrow?: boolean }
>(function TooltipContent({ className, sideOffset = 6, arrow = true, children, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // `bg-text` / `text-text-inverse` is the one pair that inverts
          // correctly on its own: dark bubble on light, light bubble on dark.
          "z-50 max-w-[16rem] rounded-[var(--radius-sm)] bg-text px-2 py-1",
          "text-[0.6875rem] leading-snug font-medium text-text-inverse shadow-md",
          "origin-[var(--radix-tooltip-content-transform-origin)] will-change-[transform,opacity]",
          "data-[state=delayed-open]:animate-[ui-pop-in_140ms_var(--ease-out-quart)]",
          "data-[state=closed]:animate-[ui-pop-out_120ms_var(--ease-out-quart)]",
          className,
        )}
        {...props}
      >
        {children}
        {arrow ? <TooltipPrimitive.Arrow className="fill-text" width={9} height={4.5} /> : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export const TooltipArrow = TooltipPrimitive.Arrow;
