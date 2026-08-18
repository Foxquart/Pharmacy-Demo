"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { controlClassName, Field, type InputSize } from "./input";
import "./animations.css";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  size?: InputSize;
  /** Error state — matches `Input`'s `border-danger` treatment exactly. */
  error?: boolean;
}

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(function SelectTrigger({ className, size = "md", error = false, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        // Same shell as Input, so a select and a text field on the same row are
        // the same height and share one border language.
        controlClassName(size, error),
        "group flex items-center justify-between gap-2 text-left",
        "not-disabled:active:bg-surface-hover",
        "data-[placeholder]:text-text-tertiary",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <CaretDown
          size={13}
          weight="bold"
          className="shrink-0 text-text-tertiary transition-transform duration-150 ease-[var(--ease-out-quart)] group-data-[state=open]:rotate-180"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn("flex h-6 items-center justify-center text-text-tertiary", className)}
      {...props}
    >
      <CaretUp size={12} weight="bold" />
    </SelectPrimitive.ScrollUpButton>
  );
});

export const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn("flex h-6 items-center justify-center text-text-tertiary", className)}
      {...props}
    >
      <CaretDown size={12} weight="bold" />
    </SelectPrimitive.ScrollDownButton>
  );
});

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent(
  { className, children, position = "popper", sideOffset = 6, ...props },
  ref,
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden",
          "rounded-[var(--radius-md)] border border-border bg-surface-raised text-text shadow-lg",
          "origin-[var(--radix-select-content-transform-origin)] will-change-[transform,opacity]",
          "data-[state=open]:animate-[ui-pop-in_160ms_var(--ease-out-quart)]",
          "data-[state=closed]:animate-[ui-pop-out_140ms_var(--ease-out-quart)]",
          position === "popper" && "min-w-[var(--radix-select-trigger-width)]",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 pt-2 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
});

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex h-8 cursor-default items-center rounded-[var(--radius-sm)] py-0 pr-2 pl-8",
        "text-[0.8125rem] text-text outline-none select-none",
        "transition-colors duration-100 ease-[var(--ease-out-quart)]",
        "data-[highlighted]:bg-surface-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={13} weight="bold" className="text-brand-text" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
});

export interface SelectFieldProps extends SelectTriggerProps {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  hint?: React.ReactNode;
  fieldClassName?: string;
}

/** `SelectTrigger` with the same label-above / helper-below field chrome as
 *  `Input`, so a form of mixed controls reads as one column. */
export const SelectField = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectFieldProps
>(function SelectField(
  { label, helperText, errorText, hint, fieldClassName, error, id, children, ...props },
  ref,
) {
  const autoId = React.useId();
  const controlId = id ?? autoId;
  const invalid = error || Boolean(errorText);
  return (
    <Field
      className={fieldClassName}
      label={label}
      htmlFor={controlId}
      helperText={helperText}
      errorText={errorText}
      hint={hint}
      helperId={`${controlId}-helper`}
      errorId={`${controlId}-error`}
    >
      <SelectTrigger
        ref={ref}
        id={controlId}
        error={invalid}
        aria-describedby={errorText ? `${controlId}-error` : helperText ? `${controlId}-helper` : undefined}
        {...props}
      >
        {children}
      </SelectTrigger>
    </Field>
  );
});
