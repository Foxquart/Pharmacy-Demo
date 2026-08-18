"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import "./animations.css";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export type SheetSide = "right" | "left" | "bottom";

/* Sheets travel on `translate` only — no width, height or inset animation, so
   the panel is composited and the content inside it never reflows mid-slide. */
const SIDE: Record<SheetSide, string> = {
  right:
    "inset-y-0 right-0 h-dvh w-full max-w-md border-l border-border " +
    "data-[state=open]:animate-[ui-slide-in-right_200ms_var(--ease-out-quart)] " +
    "data-[state=closed]:animate-[ui-slide-out-right_180ms_var(--ease-out-quart)]",
  left:
    "inset-y-0 left-0 h-dvh w-[17rem] max-w-[85vw] border-r border-border " +
    "data-[state=open]:animate-[ui-slide-in-left_200ms_var(--ease-out-quart)] " +
    "data-[state=closed]:animate-[ui-slide-out-left_180ms_var(--ease-out-quart)]",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-[var(--radius-xl)] border-t border-border " +
    "pb-[env(safe-area-inset-bottom)] " +
    "data-[state=open]:animate-[ui-slide-in-bottom_200ms_var(--ease-out-quart)] " +
    "data-[state=closed]:animate-[ui-slide-out-bottom_180ms_var(--ease-out-quart)]",
};

export const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-text/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-[ui-fade-in_180ms_var(--ease-out-quart)]",
        "data-[state=closed]:animate-[ui-fade-out_160ms_var(--ease-out-quart)]",
        className,
      )}
      {...props}
    />
  );
});

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: SheetSide;
  showClose?: boolean;
  closeLabel?: string;
  overlayClassName?: string;
}

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  {
    className,
    overlayClassName,
    side = "right",
    showClose = true,
    closeLabel = "Close panel",
    children,
    ...props
  },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-surface text-text shadow-xl",
          "will-change-transform",
          SIDE[side],
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              "absolute top-3.5 right-3.5 inline-flex size-7 items-center justify-center",
              "rounded-[var(--radius-sm)] text-text-tertiary",
              "transition-[background-color,color,transform] duration-150 ease-[var(--ease-out-quart)]",
              "hover:bg-surface-hover hover:text-text active:scale-[0.94] active:bg-surface-active",
            )}
          >
            <X size={15} weight="bold" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 border-b border-border px-4 py-4 pr-12 sm:px-5 sm:pr-14",
        className,
      )}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3.5 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

export const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-[0.9375rem] leading-tight font-medium text-text", className)}
      {...props}
    />
  );
});

export const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-[0.8125rem] leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
});
