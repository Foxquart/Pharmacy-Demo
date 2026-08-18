"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui";
import { renderUpiQr } from "@/lib/qr";
import { cn } from "@/lib/utils";

export interface UpiQrProps {
  upiUri: string;
  /** The code's natural display width. It is a ceiling, not a fixed size: on a
   *  narrow viewport the frame shrinks to the column it is given. */
  size?: number;
  /** Dims and desaturates once the code is no longer worth scanning. */
  spent?: boolean;
  className?: string;
}

/**
 * The QR is regenerated whenever the theme flips, not recoloured with CSS.
 *
 * A filter or a blend mode over a light-mode PNG destroys the contrast ratio the
 * decoder relies on, and a code that needs three tries across a counter is worse
 * than no code at all. `renderUpiQr` paints the modules in the theme's own ink
 * on a transparent ground, so the plain surface behind it shows through.
 */
export function UpiQr({ upiUri, size = 280, spent = false, className }: UpiQrProps) {
  const { resolvedTheme } = useTheme();
  // The render is keyed by everything that changes the pixels. Holding the key
  // alongside the image means a stale code is never shown against a new amount
  // or a freshly flipped theme, without clearing state from inside the effect.
  const renderKey = `${upiUri}|${size}|${resolvedTheme ?? "light"}`;
  const [rendered, setRendered] = React.useState<{ key: string; url: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    renderUpiQr(upiUri, { size: size * 2, dark: resolvedTheme === "dark" })
      .then((url) => {
        if (!cancelled) setRendered({ key: renderKey, url });
      })
      .catch(() => {
        if (!cancelled) setRendered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [renderKey, upiUri, size, resolvedTheme]);

  const dataUrl = rendered?.key === renderKey ? rendered.url : null;

  return (
    <div
      className={cn(
        // The code is rendered at twice its display size, so shrinking the frame
        // on a phone costs no scan accuracy: the decoder still gets clean edges.
        "flex w-full max-w-full shrink-0 items-center justify-center",
        "rounded-[var(--radius-lg)] border border-border bg-surface p-3",
        "transition-opacity duration-150 ease-[var(--ease-out-quart)]",
        spent && "opacity-40",
        className,
      )}
      style={{ width: size + 24 }}
    >
      {dataUrl ? (
        <Image
          src={dataUrl}
          alt="UPI payment QR code"
          width={size}
          height={size}
          unoptimized
          priority
          className="h-auto w-full"
        />
      ) : (
        <Skeleton className="aspect-square w-full rounded-[var(--radius-md)]" />
      )}
    </div>
  );
}
