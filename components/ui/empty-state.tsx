import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateSize = "sm" | "md";

export interface EmptyStateProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  /** An icon element, sized by the caller (24–28px reads best). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Say what this space will hold and what to do next — never just "No data". */
  description?: React.ReactNode;
  /** Primary action. A second, quieter action can go in `secondaryAction`. */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** Keyboard hint row, e.g. `<KbdGroup><Kbd>N</Kbd></KbdGroup>`. */
  footer?: React.ReactNode;
  size?: EmptyStateSize;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  footer,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        size === "md" ? "gap-4 px-6 py-14" : "gap-3 px-4 py-9",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[var(--radius-lg)]",
            "border border-border bg-bg-sunken text-text-tertiary",
            size === "md" ? "size-12" : "size-10",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}

      <div className="flex max-w-sm flex-col gap-1.5">
        <p
          className={cn(
            "font-medium text-text",
            size === "md" ? "text-[0.9375rem]" : "text-sm",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="text-[0.8125rem] leading-relaxed text-balance text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}

      {footer ? (
        <div className="flex items-center gap-1.5 pt-1 text-xs text-text-tertiary">{footer}</div>
      ) : null}
    </div>
  );
}
