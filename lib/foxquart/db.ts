import { neon } from "@neondatabase/serverless";

/**
 * The Foxquart Neon database — the same instance foxquart.com writes to, so
 * enquiries raised from this demo land in the existing admin inbox rather than
 * in a second silo.
 *
 * Neon's HTTP driver issues each query as a fetch, so there is no pool to keep
 * warm across serverless invocations. Resolved lazily so importing this module
 * never throws at build time; only querying without DATABASE_URL does.
 */
export function getFoxquartDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the Foxquart Neon pooled connection string to the environment.",
    );
  }
  return neon(url);
}
