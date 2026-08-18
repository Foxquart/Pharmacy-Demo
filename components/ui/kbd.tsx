import * as React from "react";
import { cn } from "@/lib/utils";

export type KbdSize = "sm" | "md";

const SIZE: Record<KbdSize, string> = {
  sm: "h-[1.125rem] min-w-[1.125rem] px-1 text-[0.625rem]",
  md: "h-5 min-w-5 px-1.5 text-[0.6875rem]",
};

export interface KbdProps extends React.ComponentPropsWithoutRef<"kbd"> {
  size?: KbdSize;
}

/** A single key cap. This app is keyboard-first, so these appear everywhere:
 *  in menus, on buttons, in the command bar and in empty states. */
export const Kbd = React.forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className, size = "md", ...props },
  ref,
) {
  return (
    <kbd
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
        "border border-border bg-bg-sunken font-mono font-medium text-text-secondary",
        "tracking-tight whitespace-nowrap",
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
});

export interface KbdGroupProps extends React.ComponentPropsWithoutRef<"span"> {
  /** Rendered between caps — a thin "then"/"plus" hint. */
  separator?: React.ReactNode;
}

/** Groups key caps for a chord: `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>` */
export const KbdGroup = React.forwardRef<HTMLSpanElement, KbdGroupProps>(function KbdGroup(
  { className, separator, children, ...props },
  ref,
) {
  const items = React.Children.toArray(children);
  return (
    <span ref={ref} className={cn("inline-flex items-center gap-1", className)} {...props}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && separator ? (
            <span className="text-[0.625rem] text-text-tertiary" aria-hidden="true">
              {separator}
            </span>
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </span>
  );
});
