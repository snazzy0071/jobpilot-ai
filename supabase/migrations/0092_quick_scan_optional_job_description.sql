-- The Free ATS Checker's job description field is now optional (a caller with
-- no specific role in mind can run a general CV/ATS-readiness check instead
-- of a job-matched one — see src/lib/quick-scan/quick-scan-actions.ts's
-- NO_JOB_DESCRIPTION_PLACEHOLDER). The result page/PDF/email need to know
-- which kind of scan a persisted row was, since the raw job description
-- itself is (deliberately) never stored to tell them apart after the fact.
--
-- Defaults to true: every row that already exists was scanned before this
-- field was optional, so it genuinely was matched against a real job
-- description.
alter table public.quick_scan_results
  add column has_job_description boolean not null default true;
