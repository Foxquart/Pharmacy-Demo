"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The counter is open 8:30 am to 10:30 pm Monday to Saturday, and 9:00 am to
 * 9:00 pm on Sunday. Those two rows are the single source of truth for the
 * hours shown anywhere on this site.
 */
const WEEKDAY = { opens: 8 * 60 + 30, closes: 22 * 60 + 30, opensLabel: "8:30 am", closesLabel: "10:30 pm" };
const SUNDAY = { opens: 9 * 60, closes: 21 * 60, opensLabel: "9:00 am", closesLabel: "9:00 pm" };

type Signal = { open: boolean; prefix: string; time: string };

function istParts(offsetDays = 0) {
  const at = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    sunday: value("weekday") === "Sun",
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function readSignal(): Signal {
  const today = istParts();
  const hours = today.sunday ? SUNDAY : WEEKDAY;

  if (today.minutes >= hours.opens && today.minutes < hours.closes) {
    return { open: true, prefix: "Open now, until", time: hours.closesLabel };
  }
  if (today.minutes < hours.opens) {
    return { open: false, prefix: "Closed, opens at", time: hours.opensLabel };
  }

  const tomorrow = istParts(1);
  const next = tomorrow.sunday ? SUNDAY : WEEKDAY;
  return { open: false, prefix: "Closed, opens tomorrow at", time: next.opensLabel };
}

/**
 * Shows whether a customer standing outside right now can walk in. Resolved on
 * the client against Asia/Kolkata, so it stays honest wherever the page is read
 * from. Before that it says the plain, always-true thing.
 */
export function OpenNow({ className }: { className?: string }) {
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    const update = () => setSignal(readSignal());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-1.5 rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium",
        signal === null && "bg-bg-sunken text-text-secondary",
        signal?.open === true && "bg-success-subtle text-success-text",
        signal?.open === false && "bg-warning-subtle text-warning-text",
        className,
      )}
    >
      {signal === null ? (
        <span>Open seven days a week</span>
      ) : (
        <>
          <span>{signal.prefix}</span>
          <span className="numeric">{signal.time}</span>
        </>
      )}
    </p>
  );
}
