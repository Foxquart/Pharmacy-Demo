-- Optional, additive, idempotent. Tags each enquiry with the Foxquart property
-- it came from, so demo leads can be told apart from foxquart.com leads in the
-- admin inbox.
--
-- Safe to run against the live database: the NOT NULL default backfills every
-- existing row with 'foxquart.com', and nothing in the main site reads or
-- writes this column, so its behaviour is unchanged.
--
-- The demo's contact endpoint works with or without this migration: if the
-- column is absent it retries the insert without it. Run this to get
-- attribution; skip it and enquiries still arrive.
ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'foxquart.com';

CREATE INDEX IF NOT EXISTS contact_submissions_source
  ON contact_submissions (source, created_at DESC);
