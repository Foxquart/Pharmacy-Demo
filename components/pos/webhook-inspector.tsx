"use client";

import * as React from "react";
import { CaretRight } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import type { WebhookEvent } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { toBadgeTone } from "./expiry-badge";

const STATUS_TONE: Record<WebhookEvent["status"], string> = {
  RECEIVED: "neutral",
  PROCESSED: "success",
  IGNORED: "warning",
  FAILED: "danger",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-[0.75rem] text-text-secondary">{label}</span>
      <span className="numeric max-w-[62%] truncate text-right text-[0.75rem] text-text">
        {value}
      </span>
    </div>
  );
}

/**
 * The event that actually drove the settlement, shown verbatim.
 *
 * Everything else on this screen is an interpretation of this object. Putting
 * the raw signed payload one click away is the difference between "the demo said
 * it was paid" and "here is the message that moved the stock", and it is where a
 * pharmacist's accountant will look first.
 */
export function WebhookInspector({ event }: { event: WebhookEvent }) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-bg-sunken">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left",
          "transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-surface-hover",
          "rounded-[var(--radius-md)]",
        )}
      >
        <CaretRight
          size={13}
          weight="bold"
          aria-hidden="true"
          className={cn(
            "shrink-0 text-text-tertiary",
            "transition-transform duration-150 ease-[var(--ease-out-quart)]",
            open && "rotate-90",
          )}
        />
        <span className="text-[0.8125rem] font-medium text-text">Webhook event</span>
        <span className="numeric truncate text-[0.75rem] text-text-tertiary">
          {event.eventType}
        </span>
        <Badge tone={toBadgeTone(STATUS_TONE[event.status])} size="sm" className="ml-auto">
          {event.status}
        </Badge>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border px-3 py-2.5">
          <Field label="Event id" value={event.eventId} />
          <Field label="Type" value={event.eventType} />
          <Field label="Provider" value={event.provider} />
          <Field label="Received" value={new Date(event.receivedAt).toLocaleTimeString()} />
          <Field
            label="Signature"
            value={<span title={event.signature}>{event.signature}</span>}
          />
          {event.note ? (
            <p className="mt-1 text-[0.75rem] leading-relaxed text-warning-text">{event.note}</p>
          ) : null}

          <p className="mt-3 mb-1.5 text-[0.6875rem] font-medium tracking-wide text-text-tertiary">
            Payload
          </p>
          <pre className="max-h-52 overflow-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2.5 font-mono text-[0.6875rem] leading-relaxed text-text-secondary">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
