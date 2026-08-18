import { z } from "zod";

/**
 * Mirrors foxquart.com's contact schema so rows written from this demo are
 * indistinguishable from rows written by the main site, and the existing admin
 * inbox keeps working without a special case.
 *
 * Kept free of server-only imports and secrets: it ships in the client bundle
 * so the form can validate before it ever hits the network.
 *
 * Note: foxquart.com is on zod 3, this app is on zod 4, so the syntax differs
 * slightly (`z.email()` rather than `z.string().email()`). The resulting shape
 * and the error copy are deliberately identical.
 */

export const PROJECT_TYPES = [
  "Custom software / ERP",
  "AI & workflow automation",
  "Cloud & DevOps",
  "Data intelligence",
  "Website / landing page",
  "Mobile application",
] as const;

export const TIMELINES = [
  "As soon as possible",
  "Within 3 months",
  "Later this year",
  "Just exploring",
] as const;

/** One-tap call-time preferences; times are read in the sender's own timezone. */
export const PREFERRED_TIMES = [
  "Anytime",
  "Morning (9-12)",
  "Afternoon (12-4)",
  "Evening (4-8)",
] as const;

/** Identifies which Foxquart property an enquiry came from. */
export const SUBMISSION_SOURCE = "pharmacy-demo.foxquart.com";

export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tell us who to address the reply to.")
    .max(200, "That name is too long: 200 characters at most."),
  email: z
    .string()
    .trim()
    .min(1, "We need an address to reply to.")
    .max(320, "That email address is too long.")
    .pipe(z.email("That does not look like an email address.")),
  company: z.string().trim().max(200, "Keep the company name under 200 characters.").default(""),
  phone: z.string().trim().max(50, "Keep the phone number under 50 characters.").default(""),
  // Optional by design: the fields above already capture who they are and what
  // they need, so the note at the end is a bonus, not a gate.
  message: z
    .string()
    .trim()
    .max(5000, "Please keep the message under 5,000 characters.")
    .default(""),
  projectType: z.enum(PROJECT_TYPES),
  timeline: z.enum(TIMELINES),
  preferredTime: z.enum(PREFERRED_TIMES).default("Anytime"),
  timezone: z.string().trim().max(100, "Keep this under 100 characters.").default(""),
  /** Honeypot. Humans never see this field, so anything in it means a bot. */
  website: z.string().max(500).default(""),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export interface ContactResponse {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
