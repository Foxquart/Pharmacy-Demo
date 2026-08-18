"use client";

import * as React from "react";
import { CheckCircle, Info, Warning, WarningOctagon, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

/* Info uses the accent ramp, not brand: brand is reserved for navigation and
   primary actions, so a standing notice never competes with the button the
   operator is meant to press. */
const TONE: Record<AlertTone, string> = {
  info: "border-accent-border bg-accent-subtle text-accent-text",
  success: "border-success-border bg-success-subtle text-success-text",
  warning: "border-warning-border bg-warning-subtle text-warning-text",
  danger: "border-danger-border bg-danger-subtle text-danger-text",
};

const TONE_ICON: Record<AlertTone, Icon> = {
  info: Info,
  success: CheckCircle,
  warning: Warning,
  danger: WarningOctagon,
};

const ROLE: Record<AlertTone, "status" | "alert"> = {
  info: "status",
  success: "status",
  warning: "status",
  danger: "alert",
};

export interface AlertProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  tone?: AlertTone;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Replaces the default tone icon. Pass `null` to drop the icon entirely. */
  icon?: React.ReactNode;
  /** Trailing slot for a button or link — "View batches", "Dismiss all". */
  action?: React.ReactNode;
  /** Shows a close button. Handler owns the dismissal state. */
  onDismiss?: () => void;
  /** Label for the close button. Say what is being dismissed. */
  dismissLabel?: string;
}

/** Inline notice for expiry, low stock and prescription warnings. Sits in the
 *  flow of the page — it never floats, never animates in, never steals focus. */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    className,
    tone = "info",
    title,
    description,
    icon,
    action,
    onDismiss,
    dismissLabel = "Dismiss notice",
    children,
    ...props
  },
  ref,
) {
  const ToneIcon = TONE_ICON[tone];

  return (
    <div
      ref={ref}
      role={ROLE[tone]}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-md)] border p-3.5",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {icon === null ? null : (
        <span className="mt-px inline-flex shrink-0 items-center" aria-hidden="true">
          {icon ?? <ToneIcon size={17} weight="fill" />}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="text-[0.8125rem] leading-snug font-medium">{title}</p> : null}
        {description ? (
          <p className="text-[0.8125rem] leading-relaxed opacity-90">{description}</p>
        ) : null}
        {children}
        {action ? <div className="flex items-center gap-2 pt-1.5">{action}</div> : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(
            "-mt-0.5 -mr-0.5 inline-flex size-6 shrink-0 items-center justify-center",
            "rounded-[var(--radius-sm)] opacity-70",
            // Opacity only: any neutral hover fill would sit wrong on the
            // tinted ground and read as a second, competing surface.
            "transition-[opacity,transform] duration-150 ease-[var(--ease-out-quart)]",
            "hover:opacity-100 active:scale-[0.94]",
          )}
        >
          <X size={13} weight="bold" />
        </button>
      ) : null}
    </div>
  );
});
