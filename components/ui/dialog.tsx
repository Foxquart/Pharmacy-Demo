"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import "./animations.css";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export type DialogSize = "sm" | "md" | "lg";

const SIZE: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        // The scrim is the ink colour at 40% — it darkens in light mode and
        // still reads as a veil in dark mode, where a black scrim would vanish.
        "fixed inset-0 z-50 bg-text/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-[ui-fade-in_180ms_var(--ease-out-quart)]",
        "data-[state=closed]:animate-[ui-fade-out_160ms_var(--ease-out-quart)]",
        className,
      )}
      {...props}
    />
  );
});

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
  /** Hides the built-in close button when the dialog must be resolved by choice. */
  showClose?: boolean;
  closeLabel?: string;
  overlayClassName?: string;
}

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  {
    className,
    overlayClassName,
    size = "md",
    showClose = true,
    closeLabel = "Close dialog",
    children,
    ...props
  },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay className={overlayClassName} />
      {/* Centring lives on this wrapper, so the panel itself only ever animates
          opacity and scale — never top/left, never width/height. The wrapper is
          click-through so the overlay still catches outside clicks. */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "pointer-events-auto relative flex max-h-[85dvh] w-full flex-col overflow-hidden",
            "rounded-[var(--radius-lg)] border border-border bg-surface text-text shadow-xl",
            "origin-center will-change-[transform,opacity]",
            "data-[state=open]:animate-[ui-scale-in_180ms_var(--ease-out-quart)]",
            "data-[state=closed]:animate-[ui-scale-out_160ms_var(--ease-out-quart)]",
            SIZE[size],
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
      </div>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
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

/** The scrolling middle. Put long content here so the header and footer stay put. */
export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5", className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
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

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-[0.9375rem] leading-tight font-medium text-text", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-[0.8125rem] leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
});
