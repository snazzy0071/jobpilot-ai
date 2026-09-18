-- Replaces migration 0030's single `cv_ats_scans` table (jsonb arrays for
-- keywords/issues, one flat score) with a normalized schema: real rows
-- per keyword and per issue instead of jsonb blobs, decomposed score
-- components instead of one flat number, explicit input provenance (what
-- was actually scanned, and where a reused job description came from),
-- and a new `ats_rewrites` table tying the existing AI-rewrite feature's
-- suggestions to a persisted, resolvable record. Safe to drop and
-- replace outright — 0030 shipped in this same pre-launch build with no
-- live project connected yet, so there is no real data to migrate.
--
-- "Scan history" isn't a separate table: `ats_scans` is append-only (one
-- row per scan, never upserted-over), which *is* the history — the same
-- reasoning as `cv_versions` never overwriting a prior version's content.

drop table if exists public.cv_ats_scans;

-- ---------------------------------------------------------------------
-- ats_scans — one row per scan run, full history kept
-- ---------------------------------------------------------------------

create type public.ats_scan_source as enum ('cv_version', 'manual_text');

create table public.ats_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Input provenance: where the CV text came from, and an immutable
  -- snapshot of exactly what was scanned — the CV itself keeps changing
  -- after a scan, so without this a scan's own result becomes
  -- unexplainable later ("why did it say X was missing?"). 'cv_version'
  -- is the only source the app writes today (the CV-editor pre-flight
  -- check); 'manual_text' is reserved for a future no-signup/pasted-CV
  -- checker against this same schema.
  source public.ats_scan_source not null default 'cv_version',
  cv_version_id uuid references public.cv_versions (id) on delete cascade,
  cv_text_snapshot text not null check (char_length(cv_text_snapshot) <= 12000),

  -- Job-description provenance: the text itself, plus which earlier scan
  -- (if any) it was reused from, when the user picks "use a previous job
  -- description" instead of pasting a fresh one.
  job_description text not null check (char_length(job_description) between 1 and 20000),
  reused_from_scan_id uuid references public.ats_scans (id) on delete set null,

  -- Score components, not one flat number: `match_score` is the AI's
  -- holistic read (src/lib/ai/prompts/ats-scan.ts); `keyword_coverage_score`
  -- and `format_score` are both deterministic (matched/total keywords,
  -- and a penalty count over public.ats_issues), computed in application
  -- code, never guessed by the model.
  match_score smallint not null check (match_score between 0 and 100),
  keyword_coverage_score smallint not null check (keyword_coverage_score between 0 and 100),
  format_score smallint not null check (format_score between 0 and 100),

  summary text not null check (char_length(summary) <= 600),
  strengths jsonb not null default '[]'::jsonb,

  -- Which version of atsScanPrompt produced this — same traceability
  -- convention as ai_usage_logs.prompt_version (migration 0023).
  prompt_version text not null check (char_length(prompt_version) <= 20),

  created_at timestamptz not null default now(),

  check (source <> 'cv_version' or cv_version_id is not null)
);

alter table public.ats_scans enable row level security;

create policy "Users manage their own ATS scans"
  on public.ats_scans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ats_scans_cv_version_id_idx on public.ats_scans (cv_version_id, created_at desc);
create index ats_scans_user_id_idx on public.ats_scans (user_id, created_at desc);
create index ats_scans_reused_from_scan_id_idx on public.ats_scans (reused_from_scan_id);

-- ---------------------------------------------------------------------
-- ats_keywords — one row per matched/missing keyword per scan
-- ---------------------------------------------------------------------

create type public.ats_keyword_status as enum ('matched', 'missing');

create table public.ats_keywords (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.ats_scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  keyword text not null check (char_length(keyword) <= 60),
  status public.ats_keyword_status not null,
  created_at timestamptz not null default now(),
  unique (scan_id, keyword, status)
);

alter table public.ats_keywords enable row level security;

create policy "Users manage their own ATS keywords"
  on public.ats_keywords for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ats_keywords_scan_id_idx on public.ats_keywords (scan_id);
create index ats_keywords_user_id_idx on public.ats_keywords (user_id);

-- ---------------------------------------------------------------------
-- ats_issues — one row per issue found in a scan, either deterministic
-- (the same content/format checks the CV editor already computes live —
-- src/lib/cvs/ats-format-checks.ts — snapshotted here for history) or
-- from the AI scan's own "improvements" list.
-- ---------------------------------------------------------------------

create type public.ats_issue_source as enum ('format', 'ai');
create type public.ats_issue_severity as enum ('warning', 'info');

create table public.ats_issues (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.ats_scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source public.ats_issue_source not null,
  severity public.ats_issue_severity not null default 'info',
  -- A stable identifier for a *kind* of deterministic issue (e.g.
  -- "summary-missing") so the same issue can be recognised across scans
  -- without string-matching `message`. Null for AI-sourced rows, which
  -- have no such fixed vocabulary.
  issue_key text check (char_length(issue_key) <= 100),
  -- One of SectionKey (src/lib/cvs/types.ts) — plain text, not a DB
  -- enum, same choice as cv_versions.section_order (migration 0027):
  -- validated at the application/Zod layer, not duplicated here. Null
  -- for an AI improvement that isn't tied to one specific section.
  section_key text,
  message text not null check (char_length(message) <= 400),
  created_at timestamptz not null default now()
);

alter table public.ats_issues enable row level security;

create policy "Users manage their own ATS issues"
  on public.ats_issues for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ats_issues_scan_id_idx on public.ats_issues (scan_id);
create index ats_issues_user_id_idx on public.ats_issues (user_id);

-- ---------------------------------------------------------------------
-- ats_rewrites — a persisted record of every AI rewrite suggestion made
-- from src/lib/cvs/ai-actions.ts (rewriteSummaryWithAi/
-- rewriteExperienceWithAi), whether or not it came from an ATS scan.
-- ---------------------------------------------------------------------

create type public.ats_rewrite_status as enum ('suggested', 'accepted', 'rejected');

create table public.ats_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  -- Set when the rewrite was requested in the context of a specific ATS
  -- scan (a future "fix this keyword gap" trigger); null for a rewrite
  -- requested directly from the Summary/Experience editor forms, as
  -- every current call site does.
  scan_id uuid references public.ats_scans (id) on delete set null,
  section_key text not null,
  original_text text not null check (char_length(original_text) <= 4000),
  suggested_text text not null check (char_length(suggested_text) <= 4000),
  explanation text not null check (char_length(explanation) <= 300),
  status public.ats_rewrite_status not null default 'suggested',
  prompt_version text not null check (char_length(prompt_version) <= 20),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status = 'suggested' or resolved_at is not null)
);

alter table public.ats_rewrites enable row level security;

create policy "Users manage their own ATS rewrites"
  on public.ats_rewrites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ats_rewrites_cv_version_id_idx on public.ats_rewrites (cv_version_id, created_at desc);
create index ats_rewrites_scan_id_idx on public.ats_rewrites (scan_id);
create index ats_rewrites_user_id_idx on public.ats_rewrites (user_id);
