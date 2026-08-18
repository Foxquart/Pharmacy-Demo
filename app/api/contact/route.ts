import { NextResponse } from "next/server";
import { contactSubmissionSchema } from "@/lib/foxquart/contact-schema";
import {
  hashIp,
  insertSubmission,
  isRateLimited,
  markEmailFailed,
  sendNotification,
} from "@/lib/foxquart/contact";

/** Reaches the Foxquart database over HTTP, so it must not be statically evaluated. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Rejects cross-site browser POSTs. Requests carrying neither header (curl,
 * server-to-server) are allowed through: CSRF is a browser problem, and the
 * endpoint is write-only so there is nothing to exfiltrate anyway.
 */
function isCrossSite(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host !== new URL(request.url).host;
    } catch {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    if (isCrossSite(request)) {
      return json({ ok: false, error: "Cross-site requests are not allowed." }, 403);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "The request body must be JSON." }, 400);
    }

    const parsed = contactSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      return json({ ok: false, error: "Check the highlighted fields.", fieldErrors }, 400);
    }

    // A filled honeypot gets a fake success, so bots learn nothing from the response.
    if (parsed.data.website) return json({ ok: true });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ipHash = ip ? await hashIp(ip) : null;

    if (ipHash && (await isRateLimited(ipHash))) {
      return json(
        { ok: false, error: "Too many messages in a short time. Please try again later." },
        429,
      );
    }

    const id = await insertSubmission(parsed.data, {
      ipHash,
      userAgent: request.headers.get("user-agent"),
    });

    // The enquiry is already stored, so a notification failure is ours to chase.
    // The visitor still gets a success rather than being asked to send it twice.
    try {
      await sendNotification(parsed.data);
    } catch (error) {
      console.error("contact: notification email failed", error);
      await markEmailFailed(id).catch((e) =>
        console.error("contact: failed to mark email_failed", e),
      );
    }

    return json({ ok: true });
  } catch (error) {
    console.error("contact: submission failed", error);
    return json({ ok: false, error: "Something went wrong on our side. Please try again." }, 500);
  }
}

/** Write-only by design: there is deliberately no handler that reads rows back out. */
const methodNotAllowed = () =>
  NextResponse.json({ ok: false, error: "Method not allowed." }, {
    status: 405,
    headers: { Allow: "POST" },
  });

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
