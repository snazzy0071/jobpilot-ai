-- Persisted, re-openable Quick Scan results (src/lib/quick-scan/) — a
-- deliberate, narrow exception to "nothing about the scan is kept"
-- (migration 0034's comment, and /free-ats-checker's own prior FAQ
-- copy): the raw CV text and job description are still never stored
-- anywhere, only the already-reduced result the user was shown (score,
-- top keywords, top fixes), so a scan can be reopened or downloaded as
-- a PDF later without re-running the AI call or keeping the source
-- documents.
--
-- Access is by unguessable token only, never by account — there is no
-- account here. `token_hash` stores a SHA-256 of a 256-bit random token
-- (src/lib/quick-scan/result-token.ts), never the raw token itself, so
-- a database read can't be turned into a usable link the way storing
-- the raw token would allow. No RLS policy exists for anon/authenticated
-- (same stance as anonymous_rate_limits, migration 0034) — every read
-- goes through the service-role admin client from a Server
-- Action/Route Handler that has already hashed and matched the caller's
-- own token server-side.
create table public.quick_scan_results (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  overall_score integer not null check (overall_score between 0 and 100),
  summary text not null check (char_length(summary) <= 600),
  matched_keywords jsonb not null default '[]'::jsonb,
  missing_keywords jsonb not null default '[]'::jsonb,
  top_fixes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  -- Bounded retention for anonymous data with no account attached to it —
  -- a result page/PDF checks this and treats an expired row as not
  -- found; nothing currently sweeps expired rows out of the table, so an
  -- actual delete job is a reasonable future addition, not required for
  -- correctness today.
  expires_at timestamptz not null
);

alter table public.quick_scan_results enable row level security;
-- No select/insert/update/delete policy for anon/authenticated — see
-- comment above.

create index quick_scan_results_expires_at_idx on public.quick_scan_results (expires_at);
