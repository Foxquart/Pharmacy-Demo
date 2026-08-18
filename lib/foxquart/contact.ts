import "server-only";
import type { ContactSubmission } from "./contact-schema";
import { SUBMISSION_SOURCE } from "./contact-schema";
import { getFoxquartDb } from "./db";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;

export interface SubmissionMeta {
  ipHash: string | null;
  userAgent: string | null;
}

/**
 * Raw IPs are never stored. The hash is enough to count submissions per source
 * for rate limiting, but is not a durable identifier we hold on to.
 * Web Crypto, so the same code runs on Node and on edge runtimes alike.
 */
export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  const db = getFoxquartDb();
  const rows = await db`
    SELECT count(*)::int AS recent
      FROM contact_submissions
     WHERE ip_hash = ${ipHash}
       AND created_at > now() - make_interval(mins => ${RATE_LIMIT_WINDOW_MINUTES})
  `;
  return ((rows[0]?.recent as number | undefined) ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS;
}

/** Postgres: column referenced in the statement does not exist. */
const UNDEFINED_COLUMN = "42703";

function isUndefinedColumn(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNDEFINED_COLUMN
  );
}

/**
 * Writes the enquiry into foxquart.com's own `contact_submissions` table.
 *
 * `source` comes from migration 002 and is optional by design: if that
 * migration has not been applied to the target database yet, the insert is
 * retried without the column. A missing attribution tag is a much better
 * outcome than a lost lead.
 */
export async function insertSubmission(
  data: ContactSubmission,
  meta: SubmissionMeta,
): Promise<string> {
  const db = getFoxquartDb();

  try {
    const rows = await db`
      INSERT INTO contact_submissions
        (name, email, company, phone, project_type, timeline,
         preferred_time, timezone, message, ip_hash, user_agent, source)
      VALUES
        (${data.name}, ${data.email}, ${data.company || null}, ${data.phone || null},
         ${data.projectType}, ${data.timeline},
         ${data.preferredTime || null}, ${data.timezone || null}, ${data.message},
         ${meta.ipHash}, ${meta.userAgent}, ${SUBMISSION_SOURCE})
      RETURNING id
    `;
    return rows[0].id as string;
  } catch (error) {
    if (!isUndefinedColumn(error)) throw error;

    const rows = await db`
      INSERT INTO contact_submissions
        (name, email, company, phone, project_type, timeline,
         preferred_time, timezone, message, ip_hash, user_agent)
      VALUES
        (${data.name}, ${data.email}, ${data.company || null}, ${data.phone || null},
         ${data.projectType}, ${data.timeline},
         ${data.preferredTime || null}, ${data.timezone || null}, ${data.message},
         ${meta.ipHash}, ${meta.userAgent})
      RETURNING id
    `;
    return rows[0].id as string;
  }
}

export async function markEmailFailed(id: string): Promise<void> {
  const db = getFoxquartDb();
  await db`UPDATE contact_submissions SET status = 'email_failed' WHERE id = ${id}`;
}

/**
 * Notifies the Foxquart inbox. Optional: the demo is useful without a Resend
 * key, and a missing key must not cost a lead, so the caller treats a throw
 * here as non-fatal once the row is already stored.
 *
 * Uses Resend's REST API directly rather than the SDK to avoid pulling another
 * dependency in for one request.
 */
export async function sendNotification(data: ContactSubmission): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const to = process.env.CONTACT_TO_EMAIL || "business@foxquart.com";
  const from = process.env.CONTACT_FROM_EMAIL || "Foxquart Website <noreply@foxquart.com>";

  const text = [
    `New enquiry from the pharmacy demo (${SUBMISSION_SOURCE}).`,
    ``,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Company: ${data.company || "(not provided)"}`,
    `Phone: ${data.phone || "(not provided)"}`,
    ``,
    `Area: ${data.projectType}`,
    `Timeline: ${data.timeline}`,
    `Preferred time to talk: ${data.preferredTime || "(no preference)"}${
      data.preferredTime && data.timezone ? ` (${data.timezone})` : ""
    }`,
    ``,
    `Message:`,
    data.message || "(none)",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: data.email,
      subject: `Pharmacy demo enquiry from ${data.name}${data.company ? ` (${data.company})` : ""}`,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the notification: ${response.status} ${await response.text()}`);
  }
}
