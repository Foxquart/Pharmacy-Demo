"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Dense by default. This is a counter tool: the operator wants as many batches
   on screen as will still read cleanly, so rows are 36px and padding is 12px.
   Row separation lives on the body as `divide-y` — putting a border on both the
   top and the bottom of every row doubles every hairline and makes the grid look
   dirty at 100% zoom.

   `numeric` cells take the global `.numeric` class (mono face + tabular figures),
   because the product typeface has no tabular numerals of its own. */

const StickyHeaderContext = React.createContext(false);

export interface TableProps extends React.ComponentPropsWithoutRef<"table"> {
  /** Pins `<TableHeader>` to the top of the scroll container. */
  stickyHeader?: boolean;
  /** Classes for the scroll container that wraps the table. */
  containerClassName?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, containerClassName, stickyHeader = false, ...props },
  ref,
) {
  return (
    <StickyHeaderContext.Provider value={stickyHeader}>
      <div className={cn("relative w-full overflow-auto", containerClassName)}>
        <table
          ref={ref}
          className={cn("w-full border-collapse text-left text-sm", className)}
          {...props}
        />
      </div>
    </StickyHeaderContext.Provider>
  );
});

export interface TableHeaderProps extends React.ComponentPropsWithoutRef<"thead"> {
  /** Overrides the value inherited from `<Table stickyHeader>`. */
  stickyHeader?: boolean;
}

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  function TableHeader({ className, stickyHeader, ...props }, ref) {
    const inherited = React.useContext(StickyHeaderContext);
    const sticky = stickyHeader ?? inherited;
    return (
      <thead
        ref={ref}
        className={cn(
          "bg-bg-sunken [&_tr]:border-b [&_tr]:border-border",
          sticky && "sticky top-0 z-10",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"tbody">
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn("divide-y divide-border", className)} {...props} />;
});

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<"tfoot">
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t border-border bg-bg-sunken font-medium text-text", className)}
      {...props}
    />
  );
});

export interface TableRowProps extends React.ComponentPropsWithoutRef<"tr"> {
  selected?: boolean;
  /** Adds the pointer + hover affordance for rows that open something. */
  interactive?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  { className, selected, interactive, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      data-state={selected ? "selected" : undefined}
      className={cn(
        "transition-colors duration-150 ease-[var(--ease-out-quart)]",
        "hover:bg-surface-hover data-[state=selected]:bg-brand-subtle",
        interactive && "cursor-pointer active:bg-surface-active",
        className,
      )}
      {...props}
    />
  );
});

export interface TableHeadProps extends React.ComponentPropsWithoutRef<"th"> {
  /** Right-aligns and applies tabular numerals — money, quantities, dates. */
  numeric?: boolean;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  { className, numeric, ...props },
  ref,
) {
  return (
    <th
      ref={ref}
      scope={props.scope ?? "col"}
      className={cn(
        "h-9 px-3 align-middle text-xs font-medium whitespace-nowrap text-text-secondary",
        numeric ? "numeric text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
});

export interface TableCellProps extends React.ComponentPropsWithoutRef<"td"> {
  numeric?: boolean;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { className, numeric, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={cn(
        "h-9 px-3 align-middle text-sm text-text",
        numeric ? "numeric text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
});

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentPropsWithoutRef<"caption">
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("caption-bottom py-3 text-xs text-text-tertiary", className)}
      {...props}
    />
  );
});
