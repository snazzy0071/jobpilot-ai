-- New role for institution (university) staff managing their cohort —
-- distinct from `admin` (JobPilot AI's own internal/system admins). Full
-- institution data model (which institution, seats, cohorts) belongs to
-- the not-yet-built Institutions module; this migration only adds the
-- role value so /institution-admin routes have something real to check.

alter type public.user_role add value 'institution_admin' before 'admin';
