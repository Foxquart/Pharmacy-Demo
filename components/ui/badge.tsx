import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export type BadgeSize = "sm" | "md";

/** Every tone is the same triplet: `-subtle` ground, `-border` edge, `-text` ink. */
const TONE: Record<BadgeTone, string> = {
  neutral: "border-border bg-bg-sunken text-text-secondary",
  brand: "border-brand-border bg-brand-subtle text-brand-text",
  success: "border-success-border bg-success-subtle text-success-text",
  warning: "border-warning-border bg-warning-subtle text-warning-text",
  danger: "border-danger-border bg-danger-subtle text-danger-text",
  accent: "border-accent-border bg-accent-subtle text-accent-text",
};

/** The dot uses the solid token so it reads as a status light, not as tinted text. */
const DOT: Record<BadgeTone, string> = {
  neutral: "bg-text-tertiary",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
};

const SIZE: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 rounded-[var(--radius-sm)] px-1.5 text-[0.6875rem]",
  md: "h-6 gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs",
};

export interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading status dot. Use it when the badge encodes state rather than a label. */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "neutral", size = "md", dot = false, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex max-w-full items-center border font-medium whitespace-nowrap",
        TONE[tone],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
});
