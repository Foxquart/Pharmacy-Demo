"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { CaretRight, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import "./animations.css";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const SURFACE = cn(
  "z-50 min-w-[10rem] overflow-hidden rounded-[var(--radius-md)] p-1",
  "border border-border bg-surface-raised text-text shadow-lg",
  "origin-[var(--radix-dropdown-menu-content-transform-origin)] will-change-[transform,opacity]",
  "data-[state=open]:animate-[ui-pop-in_160ms_var(--ease-out-quart)]",
  "data-[state=closed]:animate-[ui-pop-out_140ms_var(--ease-out-quart)]",
);

const ITEM_BASE = cn(
  "relative flex h-8 cursor-default items-center gap-2 rounded-[var(--radius-sm)] px-2",
  "text-[0.8125rem] outline-none select-none",
  "transition-colors duration-100 ease-[var(--ease-out-quart)]",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = "start", ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(SURFACE, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  /** Deletes, voids, refunds — anything the operator cannot undo. */
  destructive?: boolean;
  /** Indents to line up with checkbox/radio items in the same menu. */
  inset?: boolean;
  icon?: React.ReactNode;
}

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, destructive, inset, icon, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        ITEM_BASE,
        destructive
          ? "text-danger-text data-[highlighted]:bg-danger-subtle"
          : "text-text data-[highlighted]:bg-surface-hover",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.Item>
  );
});

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(ITEM_BASE, "pl-8 text-text data-[highlighted]:bg-surface-hover", className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check size={13} weight="bold" className="text-brand-text" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(ITEM_BASE, "pl-8 text-text data-[highlighted]:bg-surface-hover", className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <span className="size-1.5 rounded-full bg-brand" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 pt-2 pb-1.5 text-[0.6875rem] font-medium tracking-wide text-text-tertiary",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
});

/** Right-aligned shortcut hint. Pair with `<Kbd>` for real key caps. */
export function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn("ml-auto inline-flex shrink-0 items-center gap-1 pl-3", className)}
      {...props}
    />
  );
}

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
>(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        ITEM_BASE,
        "text-text data-[highlighted]:bg-surface-hover data-[state=open]:bg-surface-hover",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      <span className="flex-1 truncate">{children}</span>
      <CaretRight size={12} weight="bold" className="shrink-0 text-text-tertiary" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        ref={ref}
        sideOffset={sideOffset}
        className={cn(SURFACE, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
