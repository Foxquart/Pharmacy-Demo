"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputSize = "sm" | "md" | "lg";

const CONTROL_SIZE: Record<InputSize, string> = {
  sm: "h-8 px-2.5 text-[0.8125rem] rounded-[var(--radius-sm)]",
  md: "h-9 px-3 text-sm rounded-[var(--radius)]",
  lg: "h-11 px-3.5 text-[0.9375rem] rounded-[var(--radius)]",
};

/** Extra inline padding to clear a leading icon / trailing slot, per size. */
const LEADING_PAD: Record<InputSize, string> = {
  sm: "[&_input]:pl-8",
  md: "[&_input]:pl-9",
  lg: "[&_input]:pl-10",
};

const TRAILING_PAD: Record<InputSize, string> = {
  sm: "[&_input]:pr-8",
  md: "[&_input]:pr-9",
  lg: "[&_input]:pr-10",
};

const ICON_INSET: Record<InputSize, string> = {
  sm: "left-2.5",
  md: "left-3",
  lg: "left-3.5",
};

/** The shared control shell. Exported so Select's trigger can match Input exactly. */
export function controlClassName(size: InputSize = "md", invalid = false) {
  return cn(
    "w-full min-w-0 border bg-surface text-text",
    "transition-[border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]",
    "placeholder:text-text-tertiary",
    "disabled:cursor-not-allowed disabled:bg-bg-sunken disabled:text-text-tertiary disabled:opacity-70",
    CONTROL_SIZE[size],
    invalid
      ? "border-danger not-disabled:hover:border-danger"
      : "border-border not-disabled:hover:border-border-strong",
  );
}

/* ── Field: label above, helper below, error below ────────────────────────────
   The label is always a real <label> above the control. Placeholder-as-label is
   never used: it disappears the moment someone starts typing, which is exactly
   when a person under time pressure needs it most. */

export interface FieldProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  label?: React.ReactNode;
  /** `id` of the control this label points at. */
  htmlFor?: string;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  /** Right-aligned note on the label row, e.g. "optional" or a unit. */
  hint?: React.ReactNode;
  required?: boolean;
  helperId?: string;
  errorId?: string;
  children?: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  helperText,
  errorText,
  hint,
  required,
  helperId,
  errorId,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)} {...props}>
      {label || hint ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <label
              htmlFor={htmlFor}
              className="text-[0.8125rem] leading-none font-medium text-text"
            >
              {label}
              {required ? (
                <span className="ml-0.5 text-danger-text" aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>
          ) : (
            <span />
          )}
          {hint ? <span className="text-xs text-text-tertiary">{hint}</span> : null}
        </div>
      ) : null}
      {children}
      {errorText ? (
        <p id={errorId} className="text-xs leading-snug text-danger-text">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs leading-snug text-text-secondary">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/* ── InputGroup ──────────────────────────────────────────────────────────────
   Positions a leading icon and a trailing slot around any input-like child and
   pads that child to clear them. The border and the focus ring stay on the input
   itself, so the global `:focus-visible` outline lands exactly where it should. */

export interface InputGroupProps extends React.ComponentPropsWithoutRef<"div"> {
  leadingIcon?: React.ReactNode;
  /** Trailing slot: a unit label, a clear button, a Kbd hint, a spinner. */
  trailing?: React.ReactNode;
  size?: InputSize;
}

export const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(function InputGroup(
  { className, leadingIcon, trailing, size = "md", children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full items-center",
        leadingIcon && LEADING_PAD[size],
        trailing && TRAILING_PAD[size],
        className,
      )}
      {...props}
    >
      {leadingIcon ? (
        <span
          className={cn(
            "pointer-events-none absolute inline-flex items-center text-text-tertiary",
            ICON_INSET[size],
          )}
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {trailing ? (
        <span className="absolute right-2 inline-flex items-center gap-1 text-text-tertiary">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

/* ── Input ───────────────────────────────────────────────────────────────── */

export interface InputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  /** Presence of this string puts the field in its error state automatically. */
  errorText?: React.ReactNode;
  hint?: React.ReactNode;
  /** Force the error border without an error message. */
  error?: boolean;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  size?: InputSize;
  /** Classes for the outer field wrapper (label + control + message). */
  fieldClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    fieldClassName,
    label,
    helperText,
    errorText,
    hint,
    error = false,
    leadingIcon,
    trailing,
    size = "md",
    id,
    required,
    ...props
  },
  ref,
) {
  const autoId = React.useId();
  const controlId = id ?? autoId;
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;
  const invalid = error || Boolean(errorText);

  const control = (
    <input
      ref={ref}
      id={controlId}
      required={required}
      aria-invalid={invalid || undefined}
      aria-describedby={errorText ? errorId : helperText ? helperId : undefined}
      className={cn(controlClassName(size, invalid), className)}
      {...props}
    />
  );

  return (
    <Field
      className={fieldClassName}
      label={label}
      htmlFor={controlId}
      helperText={helperText}
      errorText={errorText}
      hint={hint}
      required={required}
      helperId={helperId}
      errorId={errorId}
    >
      {leadingIcon || trailing ? (
        <InputGroup leadingIcon={leadingIcon} trailing={trailing} size={size}>
          {control}
        </InputGroup>
      ) : (
        control
      )}
    </Field>
  );
});

/* ── NumberInput ─────────────────────────────────────────────────────────────
   Quantities, MRP, discounts. Right-aligned and tabular so a column of them
   lines up on the decimal point and does not jitter as digits change. Defaults
   to `type="text"` with a decimal keypad: number spinners are a liability at a
   counter, where a stray scroll can silently change a price. */

export interface NumberInputProps extends InputProps {
  /** Set to "left" only when the value is an identifier, not a quantity. */
  align?: "left" | "right";
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ className, align = "right", inputMode, type, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type={type ?? "text"}
        inputMode={inputMode ?? "decimal"}
        autoComplete="off"
        className={cn(
          // `.numeric` (globals.css) switches to the mono face with tabular
          // figures — the product sans has no tabular numerals.
          "numeric",
          align === "right" ? "text-right" : "text-left",
          className,
        )}
        {...props}
      />
    );
  },
);
