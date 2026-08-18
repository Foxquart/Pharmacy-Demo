"use client";

import * as React from "react";
import { ArrowRight, CheckCircle, Warning } from "@phosphor-icons/react";
import {
  Button,
  Field,
  Input,
  SelectContent,
  SelectField,
  SelectItem,
  SelectValue,
  Select,
  Alert,
} from "@/components/ui";
import {
  PREFERRED_TIMES,
  PROJECT_TYPES,
  TIMELINES,
  contactSubmissionSchema,
  type ContactResponse,
} from "@/lib/foxquart/contact-schema";
import { cn } from "@/lib/utils";

type FieldName =
  | "name"
  | "email"
  | "company"
  | "phone"
  | "projectType"
  | "timeline"
  | "preferredTime"
  | "message";

const INITIAL = {
  name: "",
  email: "",
  company: "",
  phone: "",
  projectType: "Custom software / ERP" as (typeof PROJECT_TYPES)[number],
  timeline: "Within 3 months" as (typeof TIMELINES)[number],
  preferredTime: "Anytime" as (typeof PREFERRED_TIMES)[number],
  message: "",
};

export function ContactForm() {
  const [values, setValues] = React.useState(INITIAL);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");
  // Honeypot. Kept out of React state deliberately so nothing ever renders it.
  const honeypot = React.useRef<HTMLInputElement>(null);
  const errorSummary = React.useRef<HTMLDivElement>(null);

  function set<K extends keyof typeof INITIAL>(key: K, value: (typeof INITIAL)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear the error the moment the operator starts fixing it, rather than
    // making them submit again to find out whether it is resolved.
    setErrors((e) => (e[key as FieldName] ? { ...e, [key]: undefined } : e));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const payload = {
      ...values,
      website: honeypot.current?.value ?? "",
      // Sent so a reply can be scheduled against the sender's own clock rather
      // than ours. Falls back silently on browsers that do not expose it.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    };

    // Validate with the same schema the server uses, so the visitor gets the
    // identical message locally instead of a round trip to find out.
    const parsed = contactSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "") as FieldName;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      errorSummary.current?.focus();
      return;
    }

    setStatus("sending");
    setErrors({});

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ContactResponse;

      if (!response.ok || !body.ok) {
        setErrors({
          ...(body.fieldErrors as Partial<Record<FieldName, string>> | undefined),
          form: body.error ?? "Something went wrong. Please try again.",
        });
        setStatus("idle");
        errorSummary.current?.focus();
        return;
      }

      setStatus("sent");
    } catch {
      setErrors({
        form: "We could not reach the server. Check your connection and try again.",
      });
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div
        className="rounded-[var(--radius-lg)] border border-success-border bg-success-subtle p-8"
        role="status"
      >
        <CheckCircle size={28} weight="fill" className="text-success" aria-hidden="true" />
        <h2 className="mt-4 text-[1.375rem] font-light tracking-[-0.02em] text-text">
          Message received.
        </h2>
        <p className="mt-2 max-w-[46ch] text-[0.9375rem] leading-relaxed text-text-secondary">
          It has landed in the Foxquart inbox and someone will reply to{" "}
          <span className="numeric text-text">{values.email}</span>, usually within one working day.
        </p>
        <Button
          variant="secondary"
          size="md"
          className="mt-6"
          onClick={() => {
            setValues(INITIAL);
            setStatus("idle");
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {/* Honeypot. Hidden from sight and from assistive tech, and never focusable,
          so only an automated filler can reach it. */}
      <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          ref={honeypot}
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div
        ref={errorSummary}
        tabIndex={-1}
        aria-live="polite"
        className={cn(errors.form ? "block" : "sr-only")}
      >
        {errors.form ? (
          <Alert tone="danger" icon={<Warning size={18} weight="fill" />} description={errors.form} />
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" required errorText={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={values.name}
            error={Boolean(errors.name)}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="email" required errorText={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            error={Boolean(errors.email)}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <Field label="Company" htmlFor="company" hint="optional" errorText={errors.company}>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            value={values.company}
            error={Boolean(errors.company)}
            onChange={(e) => set("company", e.target.value)}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" hint="optional" errorText={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            error={Boolean(errors.phone)}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select value={values.projectType} onValueChange={(v) => set("projectType", v as typeof values.projectType)}>
          <SelectField label="What do you need" id="projectType" errorText={errors.projectType}>
            <SelectValue />
          </SelectField>
          <SelectContent>
            {PROJECT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={values.timeline} onValueChange={(v) => set("timeline", v as typeof values.timeline)}>
          <SelectField label="Timeline" id="timeline" errorText={errors.timeline}>
            <SelectValue />
          </SelectField>
          <SelectContent>
            {TIMELINES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select value={values.preferredTime} onValueChange={(v) => set("preferredTime", v as typeof values.preferredTime)}>
        <SelectField
          label="Best time to call"
          id="preferredTime"
          helperText="Read in your own timezone, which we pick up automatically."
          errorText={errors.preferredTime}
        >
          <SelectValue />
        </SelectField>
        <SelectContent>
          {PREFERRED_TIMES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Field
        label="Anything else"
        htmlFor="message"
        hint="optional"
        helperText="What you have today, what it needs to do, and roughly when you need it."
        errorText={errors.message}
      >
        <textarea
          id="message"
          name="message"
          rows={5}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          className={cn(
            "w-full min-w-0 resize-y rounded-[var(--radius-md)] border bg-surface px-3 py-2.5",
            "text-[0.9375rem] leading-relaxed text-text placeholder:text-text-tertiary",
            "transition-[border-color,background-color] duration-150 ease-[var(--ease-out-quart)]",
            errors.message
              ? "border-danger hover:border-danger"
              : "border-border hover:border-border-strong",
          )}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <Button
          type="submit"
          size="lg"
          loading={status === "sending"}
          rightIcon={<ArrowRight size={16} weight="bold" />}
        >
          Send message
        </Button>
        <p className="text-[0.8125rem] leading-relaxed text-text-tertiary">
          We reply to the address you give us. Nothing is added to a mailing list.
        </p>
      </div>
    </form>
  );
}
