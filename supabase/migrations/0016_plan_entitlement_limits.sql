-- Refines the entitlements seeded in 0015_billing.sql with actual
-- reference-aligned usage limits, replacing the coarser boolean-only
-- model. A new migration rather than editing 0015 directly, per the
-- additive/forward-only rule — 0015's seed stands as the historical
-- record of what shipped first.
--
-- New/changed shape per plan (all still freely editable via UPDATE,
-- which is the point of keeping this as jsonb rather than columns):
--   cv_limit                     — number of CVs you can maintain (unchanged from 0015)
--   cv_template_count            — number of CV template designs available (new)
--   quick_ats_scans_per_month    — the free, no-JD-matching scan (new; null = unlimited)
--   tailored_ats_scans_per_month — scored against a specific job description (new; null = unlimited)
--   cover_letter_generator       — boolean
--   linkedin_optimiser           — boolean
--   job_match                    — boolean
--   grad_scheme_prep             — boolean
--   chat_interviews_per_month    — text-based Interview Coach sessions (new; null = unlimited)
--   voice_interviews_per_month   — voice Interview Coach sessions (new)
--   voice_topups_allowed         — can buy additional voice sessions beyond the monthly count (new)
--   job_tracker, visa_sponsor_register, support_tier — unchanged from 0015
--
-- IMPORTANT — this intentionally diverges from three already-shipped
-- pages, which this task did not touch (out of scope: seed data only).
-- Reconciling them is real follow-up work, not an oversight:
--   1. ATS: Free was "unlimited" everywhere (see /features/ats FAQ,
--      /free-ats-checker, the homepage's "Score my CV free" CTA). Free is
--      now capped at 2 "quick" scans/month, with the full job-description-
--      matched ("tailored") scan moved to Pro+. Those pages' copy needs
--      updating to stop claiming unlimited free ATS scanning.
--   2. Job Match: tools.ts, /pricing's comparison table, and
--      /features/jobmatch's `plan` prop all currently say Premium+. This
--      seed makes it Pro+, per "Pro: ... jobs ...".
--   3. Cover Letter Generator: tools.ts, /pricing's comparison table, and
--      /features/cover-letter's `plan` prop all currently say Pro+. This
--      seed makes it Premium+, per "Premium: Pro + cover letters ...".

update public.plans
set entitlements = '{
  "cv_limit": 1,
  "cv_template_count": 3,
  "quick_ats_scans_per_month": 2,
  "tailored_ats_scans_per_month": 0,
  "cover_letter_generator": false,
  "linkedin_optimiser": false,
  "job_match": false,
  "grad_scheme_prep": false,
  "chat_interviews_per_month": 0,
  "voice_interviews_per_month": 0,
  "voice_topups_allowed": false,
  "job_tracker": true,
  "visa_sponsor_register": true,
  "support_tier": "email"
}'::jsonb
where slug = 'free';

update public.plans
set entitlements = '{
  "cv_limit": null,
  "cv_template_count": 24,
  "quick_ats_scans_per_month": null,
  "tailored_ats_scans_per_month": null,
  "cover_letter_generator": false,
  "linkedin_optimiser": true,
  "job_match": true,
  "grad_scheme_prep": false,
  "chat_interviews_per_month": 2,
  "voice_interviews_per_month": 0,
  "voice_topups_allowed": false,
  "job_tracker": true,
  "visa_sponsor_register": true,
  "support_tier": "email"
}'::jsonb
where slug = 'pro';

update public.plans
set entitlements = '{
  "cv_limit": null,
  "cv_template_count": 24,
  "quick_ats_scans_per_month": null,
  "tailored_ats_scans_per_month": null,
  "cover_letter_generator": true,
  "linkedin_optimiser": true,
  "job_match": true,
  "grad_scheme_prep": true,
  "chat_interviews_per_month": 8,
  "voice_interviews_per_month": 4,
  "voice_topups_allowed": false,
  "job_tracker": true,
  "visa_sponsor_register": true,
  "support_tier": "email"
}'::jsonb
where slug = 'premium';

update public.plans
set entitlements = '{
  "cv_limit": null,
  "cv_template_count": 24,
  "quick_ats_scans_per_month": null,
  "tailored_ats_scans_per_month": null,
  "cover_letter_generator": true,
  "linkedin_optimiser": true,
  "job_match": true,
  "grad_scheme_prep": true,
  "chat_interviews_per_month": null,
  "voice_interviews_per_month": 10,
  "voice_topups_allowed": true,
  "job_tracker": true,
  "visa_sponsor_register": true,
  "support_tier": "priority"
}'::jsonb
where slug = 'elite';
