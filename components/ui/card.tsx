import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Lifts the card off the ground with `--shadow-sm`. Use sparingly — flat by default. */
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elevated = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface text-text",
        elevated && "shadow-sm",
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1 px-4 pt-5 pb-4 sm:px-5", className)}
        {...props}
      />
    );
  },
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<"h3">>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("text-[0.9375rem] leading-tight font-medium text-text", className)}
        {...props}
      />
    );
  },
);

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-[0.8125rem] leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("px-4 pb-5 sm:px-5", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center gap-2 border-t border-border px-4 py-3.5 sm:px-5",
          className,
        )}
        {...props}
      />
    );
  },
);
