"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export type SegmentedSize = "sm" | "md";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Overrides the accessible name when `label` is an icon or an abbreviation. */
  ariaLabel?: string;
}

const TRACK_SIZE: Record<SegmentedSize, string> = {
  sm: "h-8 gap-0.5 p-0.5 rounded-[var(--radius)]",
  md: "h-9 gap-0.5 p-1 rounded-[var(--radius-md)]",
};

const ITEM_SIZE: Record<SegmentedSize, string> = {
  sm: "gap-1.5 px-2.5 text-[0.8125rem] rounded-[var(--radius-sm)]",
  md: "gap-1.5 px-3 text-[0.8125rem] rounded-[var(--radius-sm)]",
};

export interface SegmentedProps<T extends string = string>
  extends Omit<React.ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue" | "dir"> {
  /** Reading direction, forwarded to the underlying roving-focus group. */
  dir?: "ltr" | "rtl";
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  size?: SegmentedSize;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Required: the control has no visible label of its own. */
  "aria-label": string;
}

/** Two to four mutually exclusive options. The selected segment lifts onto
 *  `bg-surface` above the sunken track — the whole state change is one surface
 *  swap plus a hairline shadow, so nothing moves. */
export function Segmented<T extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth = false,
  disabled = false,
  className,
  ...props
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      // A segmented control is never empty: re-selecting the active segment is
      // a no-op rather than a deselect.
      onValueChange={(next) => {
        if (next) onValueChange?.(next as T);
      }}
      className={cn(
        "inline-flex items-center border border-border bg-bg-sunken",
        TRACK_SIZE[size],
        fullWidth && "flex w-full",
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.ariaLabel}
          className={cn(
            "inline-flex h-full min-w-0 items-center justify-center font-medium whitespace-nowrap",
            "text-text-secondary",
            "transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-quart)]",
            "not-disabled:hover:text-text",
            "data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-xs",
            "not-disabled:active:scale-[0.98]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fullWidth && "flex-1",
            ITEM_SIZE[size],
          )}
        >
          {option.icon ? (
            <span className="inline-flex shrink-0 items-center" aria-hidden="true">
              {option.icon}
            </span>
          ) : null}
          <span className="truncate">{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
