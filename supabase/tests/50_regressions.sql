-- Regression tests for the specific anomalies flagged by this task's own
-- audit — things that are safe *today* only because of a grant/column-
-- privilege that isn't itself expressed as an RLS policy, so a
-- SELECT/UPDATE-based test elsewhere in this suite wouldn't catch a
-- future migration accidentally loosening it. These check the actual
-- privilege grant directly via Postgres's own has_function_privilege()/
-- has_column_privilege() (standard system functions, not pgTAP-
-- specific), so they fail the moment the grant changes, independent of
-- whether any test happens to exercise the function/column that day.
--
-- Note: the profiles privilege-escalation trigger (0051) already has
-- its own dedicated, more thorough suite —
-- supabase/tests/profiles_privilege_escalation.sql — not duplicated
-- here.

begin;

select plan(9);

-- ---------------------------------------------------------------------
-- get_institution_analytics(uuid) — security definer, does no internal
-- check that the caller administers the given institution_id; it's
-- safe only because it's never granted to anon/authenticated (the
-- application resolves and checks `institutionId` before calling it —
-- see src/lib/auth/session.ts's requireInstitutionAdmin(), and
-- migration 0074's own function definition). If this grant is ever
-- widened, any authenticated user could pull another institution's
-- aggregate analytics by guessing/enumerating institution_id values.
-- ---------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_institution_analytics(uuid)', 'execute'),
  false,
  'authenticated cannot execute get_institution_analytics directly'
);
select is(
  has_function_privilege('anon', 'public.get_institution_analytics(uuid)', 'execute'),
  false,
  'anon cannot execute get_institution_analytics directly'
);
select is(
  has_function_privilege('service_role', 'public.get_institution_analytics(uuid)', 'execute'),
  true,
  'service_role can execute get_institution_analytics (the only legitimate caller)'
);

-- ---------------------------------------------------------------------
-- redeem_access_code(text, uuid) — same shape: security definer,
-- trusts its own p_user_id parameter completely, safe only because it
-- isn't reachable by a client that could pass an arbitrary user id.
-- ---------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.redeem_access_code(text, uuid)', 'execute'),
  false,
  'authenticated cannot execute redeem_access_code directly (would let a client claim a code for an arbitrary user id)'
);
select is(
  has_function_privilege('anon', 'public.redeem_access_code(text, uuid)', 'execute'),
  false,
  'anon cannot execute redeem_access_code directly'
);

-- ---------------------------------------------------------------------
-- questions.correct_answer / questions.explanation — RLS can't hide a
-- column within an otherwise-visible row, so this app protects them via
-- real Postgres column privileges instead (migration 0067's own
-- comment). A row-level test (SELECT * and check the shape) wouldn't
-- reliably catch a future migration accidentally re-granting these at
-- the table level — this checks the actual column grant.
-- ---------------------------------------------------------------------

select is(
  has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'select'),
  false,
  'authenticated cannot select questions.correct_answer'
);
select is(
  has_column_privilege('authenticated', 'public.questions', 'explanation', 'select'),
  false,
  'authenticated cannot select questions.explanation'
);
select is(
  has_column_privilege('anon', 'public.questions', 'correct_answer', 'select'),
  false,
  'anon cannot select questions.correct_answer either'
);
select is(
  has_column_privilege('authenticated', 'public.questions', 'prompt', 'select'),
  true,
  'authenticated CAN select questions.prompt (positive control — the grant is real, not accidentally over-restrictive)'
);

select * from finish();
rollback;
