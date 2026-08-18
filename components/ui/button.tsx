"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { SpinnerGap } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "subtle"
  | "danger"
  | "success";

export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

/* Hover/active are gated behind `not-disabled:` so a disabled button never
   lights up under the cursor. Solid variants darken in light mode and lighten in
   dark mode on hover, because `-text` is the higher-contrast end of each ramp in
   both themes — one class pair, two correct results. */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-brand text-on-brand shadow-xs not-disabled:hover:bg-brand-hover not-disabled:active:bg-brand-active",
  secondary:
    "border border-border bg-surface text-text shadow-xs not-disabled:hover:border-border-strong not-disabled:hover:bg-surface-hover not-disabled:active:bg-surface-active",
  ghost:
    "border border-transparent bg-transparent text-text-secondary not-disabled:hover:bg-surface-hover not-disabled:hover:text-text not-disabled:active:bg-surface-active",
  subtle:
    "border border-brand-border bg-brand-subtle text-brand-text not-disabled:hover:bg-brand-subtle-hover not-disabled:active:bg-brand-subtle-hover",
  danger:
    "border border-transparent bg-danger text-on-danger shadow-xs not-disabled:hover:bg-danger-text not-disabled:active:bg-danger-text",
  success:
    "border border-transparent bg-success text-on-success shadow-xs not-disabled:hover:bg-success-text not-disabled:active:bg-success-text",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-[var(--radius-sm)] px-3 text-[0.8125rem]",
  md: "h-9 gap-2 rounded-[var(--radius)] px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-[var(--radius)] px-5 text-[0.9375rem]",
  xl: "h-12 gap-2.5 rounded-[var(--radius-md)] px-6 text-base",
  icon: "h-9 w-9 shrink-0 rounded-[var(--radius)] p-0",
};

/** Spinner sizes, matched to each size's cap height. */
const SPINNER: Record<ButtonSize, number> = {
  sm: 14,
  md: 15,
  lg: 17,
  xl: 18,
  icon: 16,
};

const BASE = [
  // `relative` is load-bearing: the loading spinner is absolutely positioned over
  // the label so the button keeps its exact width and nothing on the row shifts.
  "relative inline-flex select-none items-center justify-center",
  "font-medium whitespace-nowrap leading-none",
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-quart)]",
  "not-disabled:active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
].join(" ");

interface ButtonBaseProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  /** Swaps the label for a spinner and disables the button. Width is preserved. */
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Render as the single child element instead of a `<button>` (e.g. a link).
   *  `loading` is ignored in this mode — the child owns its own content. */
  asChild?: boolean;
}

/** `size="icon"` demands an `aria-label` at the type level: an icon-only button
 *  with no accessible name is a dead end for a screen reader, and this is the
 *  one accessibility rule a library can actually enforce for its callers. */
export type ButtonProps =
  | (ButtonBaseProps & { size?: Exclude<ButtonSize, "icon"> })
  | (ButtonBaseProps & { size: "icon"; "aria-label": string });

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    asChild = false,
    disabled,
    type,
    children,
    ...props
  },
  ref,
) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], fullWidth && "w-full", className);

  const left = leftIcon ? (
    <span className="inline-flex shrink-0 items-center" aria-hidden="true">
      {leftIcon}
    </span>
  ) : null;

  const right = rightIcon ? (
    <span className="inline-flex shrink-0 items-center" aria-hidden="true">
      {rightIcon}
    </span>
  ) : null;

  if (asChild) {
    return (
      <Slot.Root
        ref={ref as React.Ref<HTMLElement>}
        className={classes}
        aria-disabled={disabled || loading || undefined}
        data-disabled={disabled || loading ? "" : undefined}
        {...props}
      >
        {left}
        <Slot.Slottable>{children}</Slot.Slottable>
        {right}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading ? "" : undefined}
      className={classes}
      {...props}
    >
      {/* `contents` keeps the button's own gap/flex layout; `invisible` is
          inherited by the children, so they still reserve their width. */}
      <span className={cn("contents", loading && "invisible")}>
        {left}
        {children}
        {right}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <SpinnerGap size={SPINNER[size]} weight="bold" className="animate-spin" />
        </span>
      ) : null}
    </button>
  );
});
