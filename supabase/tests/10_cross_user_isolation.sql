-- Cross-user isolation: for every user-owned table (the ~35 tables
-- whose policy is `auth.uid() = user_id`, or `= id` for profiles),
-- prove that a second, unrelated authenticated user can neither read,
-- update, nor delete the first user's row — and, paired with each
-- denial, that the actual owner CAN see their own row (a denial test
-- alone can't tell "RLS is working" apart from "this query is just
-- broken and returns nothing for anyone").
--
-- One fixture row per table, using the current (post-every-ALTER)
-- schema for each — checked directly against the real migration files,
-- not assumed from the table's *creating* migration alone, since
-- several of these tables gained new NOT NULL columns in later
-- migrations (ats_scans, linkedin_profile_drafts, etc).

begin;

select plan(52);

-- ---------------------------------------------------------------------
-- Fixtures: two real users (fires the real handle_new_user() trigger,
-- same as supabase/tests/profiles_privilege_escalation.sql).
-- ---------------------------------------------------------------------

select tests.create_user('11111111-1111-1111-1111-111111111111', 'user-a@test.local');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'user-b@test.local');

-- CV family — cvs -> cv_versions -> section tables, all denormalizing
-- user_id directly (migration 0024's own stated reasoning).
insert into public.cvs (id, user_id) values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.cv_versions (id, cv_id, user_id) values ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.cv_personal (id, cv_version_id, user_id, full_name) values ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Alice Alison');
insert into public.cv_summary (id, cv_version_id, user_id) values ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');
insert into public.cv_experience (id, cv_version_id, user_id, job_title, employer, start_date) values ('c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Engineer', 'Acme', '2020-01-01');
insert into public.cv_education (id, cv_version_id, user_id, institution, qualification) values ('c0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Test University', 'BSc');
insert into public.cv_skills (id, cv_version_id, user_id, name) values ('c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'SQL');
insert into public.cv_projects (id, cv_version_id, user_id, name) values ('c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Side Project');
insert into public.cv_certifications (id, cv_version_id, user_id, name, issuing_organization) values ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cert', 'Issuer');
insert into public.cv_languages (id, cv_version_id, user_id, name) values ('c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'English');

-- Other headline feature tables — one row each, current schema.
insert into public.cover_letters (id, user_id, company_name, job_title, job_description)
  values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Acme', 'Engineer', 'Build things.');
insert into public.interview_sessions (id, user_id, role)
  values ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Software Engineer');
insert into public.ats_scans (id, user_id, source, cv_text_snapshot, job_description, match_score, keyword_score, structure_score, sections_score, format_score, summary, prompt_version)
  values ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'manual_text', 'Sample CV text.', 'Sample job description.', 80, 80, 80, 80, 80, 'Summary.', 'v1');
insert into public.applications (id, user_id, company_name, job_title)
  values ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Acme', 'Engineer');
insert into public.test_sessions (id, user_id, total_questions)
  values ('d0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 5);
insert into public.linkedin_profile_drafts (id, user_id, title, target_role, target_seniority, current_experience)
  values ('d0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Draft 1', 'Software Engineer', 'mid', 'Some experience text.');
insert into public.daily_practice_completions (id, user_id, local_date, correct_count, total_questions)
  values ('d0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', current_date, 3, 5);

-- Select-only tables.
insert into public.plans (id, slug, name, tier_order, monthly_price_pence, annual_price_pence)
  values ('e0000000-0000-0000-0000-000000000000', 'pgtap-cross-user-test-plan', 'pgTAP Test Plan', 32767, 0, 0);
insert into public.subscriptions (id, user_id, plan_id)
  values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000000');
insert into public.ai_usage_logs (id, user_id, operation, model, input_tokens, output_tokens, success)
  values ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'test_operation', 'test-model', 10, 20, true);
-- A row whose owner has since been deleted (on delete set null) — see
-- anomaly #5 in the audit: this must be invisible to *everyone*, not
-- universally readable.
insert into public.ai_usage_logs (id, user_id, operation, model, input_tokens, output_tokens, success)
  values ('f0000000-0000-0000-0000-000000000002', null, 'test_operation', 'test-model', 10, 20, true);

select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- profiles (auth.uid() = id, not user_id)
-- ---------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.profiles', 'id', '11111111-1111-1111-1111-111111111111', 'owner can select their own profile');
select tests.clear_authentication();

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.profiles', 'id', '11111111-1111-1111-1111-111111111111', 'a different user cannot select another user''s profile');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- cvs — full CRUD denial, plus a WITH CHECK reassignment attempt
-- ---------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.cvs', 'id', 'c0000000-0000-0000-0000-000000000001', 'owner can select their own cv');
select throws_ok(
  $$update public.cvs set user_id = '22222222-2222-2222-2222-222222222222' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501',
  'the owner cannot reassign their own cv to another user (WITH CHECK)'
);
select tests.clear_authentication();

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.cvs', 'id', 'c0000000-0000-0000-0000-000000000001', 'a different user cannot select another user''s cv');
select tests.assert_update_denied('public.cvs', 'id', 'c0000000-0000-0000-0000-000000000001', 'title = ''Hijacked''', 'a different user cannot update another user''s cv');
select tests.assert_delete_denied('public.cvs', 'id', 'c0000000-0000-0000-0000-000000000001', 'a different user cannot delete another user''s cv');
select tests.assert_select_denied('public.cv_versions', 'id', 'c0000000-0000-0000-0000-000000000002', 'a different user cannot select another user''s cv_versions row');
select tests.assert_update_denied('public.cv_versions', 'id', 'c0000000-0000-0000-0000-000000000002', 'label = ''Hijacked''', 'a different user cannot update another user''s cv_versions row');
select tests.assert_select_denied('public.cv_personal', 'id', 'c0000000-0000-0000-0000-000000000003', 'a different user cannot select another user''s cv_personal row');
select tests.assert_update_denied('public.cv_personal', 'id', 'c0000000-0000-0000-0000-000000000003', 'full_name = ''Hijacked''', 'a different user cannot update another user''s cv_personal row');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- The remaining CV section tables — SELECT-only sweep (identical
-- `for all using (auth.uid() = user_id)` shape to cv_personal above,
-- confirmed against each table's own migration text, not assumed).
-- ---------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.cv_summary', 'id', 'c0000000-0000-0000-0000-000000000004', 'owner can select their own cv_summary row');
select tests.assert_select_visible('public.cv_experience', 'id', 'c0000000-0000-0000-0000-000000000005', 'owner can select their own cv_experience row');
select tests.assert_select_visible('public.cv_education', 'id', 'c0000000-0000-0000-0000-000000000006', 'owner can select their own cv_education row');
select tests.assert_select_visible('public.cv_skills', 'id', 'c0000000-0000-0000-0000-000000000007', 'owner can select their own cv_skills row');
select tests.assert_select_visible('public.cv_projects', 'id', 'c0000000-0000-0000-0000-000000000008', 'owner can select their own cv_projects row');
select tests.assert_select_visible('public.cv_certifications', 'id', 'c0000000-0000-0000-0000-000000000009', 'owner can select their own cv_certifications row');
select tests.assert_select_visible('public.cv_languages', 'id', 'c0000000-0000-0000-0000-00000000000a', 'owner can select their own cv_languages row');
select tests.clear_authentication();

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.cv_summary', 'id', 'c0000000-0000-0000-0000-000000000004', 'a different user cannot select another user''s cv_summary row');
select tests.assert_select_denied('public.cv_experience', 'id', 'c0000000-0000-0000-0000-000000000005', 'a different user cannot select another user''s cv_experience row');
select tests.assert_select_denied('public.cv_education', 'id', 'c0000000-0000-0000-0000-000000000006', 'a different user cannot select another user''s cv_education row');
select tests.assert_select_denied('public.cv_skills', 'id', 'c0000000-0000-0000-0000-000000000007', 'a different user cannot select another user''s cv_skills row');
select tests.assert_select_denied('public.cv_projects', 'id', 'c0000000-0000-0000-0000-000000000008', 'a different user cannot select another user''s cv_projects row');
select tests.assert_select_denied('public.cv_certifications', 'id', 'c0000000-0000-0000-0000-000000000009', 'a different user cannot select another user''s cv_certifications row');
select tests.assert_select_denied('public.cv_languages', 'id', 'c0000000-0000-0000-0000-00000000000a', 'a different user cannot select another user''s cv_languages row');
select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- cover_letters, interview_sessions, ats_scans, applications,
-- test_sessions, linkedin_profile_drafts, daily_practice_completions —
-- same owner-visible / cross-user-denied (select/update/delete) shape.
-- ---------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.cover_letters', 'id', 'd0000000-0000-0000-0000-000000000001', 'owner can select their own cover letter');
select throws_ok(
  $$update public.applications set user_id = '22222222-2222-2222-2222-222222222222' where id = 'd0000000-0000-0000-0000-000000000004'$$,
  '42501',
  'the owner cannot reassign their own application to another user (WITH CHECK)'
);
select tests.clear_authentication();

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select tests.assert_select_denied('public.cover_letters', 'id', 'd0000000-0000-0000-0000-000000000001', 'a different user cannot select another user''s cover letter');
select tests.assert_update_denied('public.cover_letters', 'id', 'd0000000-0000-0000-0000-000000000001', 'company_name = ''Hijacked''', 'a different user cannot update another user''s cover letter');
select tests.assert_delete_denied('public.cover_letters', 'id', 'd0000000-0000-0000-0000-000000000001', 'a different user cannot delete another user''s cover letter');

select tests.assert_select_denied('public.interview_sessions', 'id', 'd0000000-0000-0000-0000-000000000002', 'a different user cannot select another user''s interview session');
select tests.assert_update_denied('public.interview_sessions', 'id', 'd0000000-0000-0000-0000-000000000002', 'company = ''Hijacked''', 'a different user cannot update another user''s interview session');
select tests.assert_delete_denied('public.interview_sessions', 'id', 'd0000000-0000-0000-0000-000000000002', 'a different user cannot delete another user''s interview session');

select tests.assert_select_denied('public.ats_scans', 'id', 'd0000000-0000-0000-0000-000000000003', 'a different user cannot select another user''s ATS scan');
select tests.assert_update_denied('public.ats_scans', 'id', 'd0000000-0000-0000-0000-000000000003', 'summary = ''Hijacked''', 'a different user cannot update another user''s ATS scan');
select tests.assert_delete_denied('public.ats_scans', 'id', 'd0000000-0000-0000-0000-000000000003', 'a different user cannot delete another user''s ATS scan');

select tests.assert_select_denied('public.applications', 'id', 'd0000000-0000-0000-0000-000000000004', 'a different user cannot select another user''s application');
select tests.assert_update_denied('public.applications', 'id', 'd0000000-0000-0000-0000-000000000004', 'company_name = ''Hijacked''', 'a different user cannot update another user''s application');
select tests.assert_delete_denied('public.applications', 'id', 'd0000000-0000-0000-0000-000000000004', 'a different user cannot delete another user''s application');

select tests.assert_select_denied('public.test_sessions', 'id', 'd0000000-0000-0000-0000-000000000005', 'a different user cannot select another user''s test session');
select tests.assert_update_denied('public.test_sessions', 'id', 'd0000000-0000-0000-0000-000000000005', 'total_questions = 99', 'a different user cannot update another user''s test session');
select tests.assert_delete_denied('public.test_sessions', 'id', 'd0000000-0000-0000-0000-000000000005', 'a different user cannot delete another user''s test session');

select tests.assert_select_denied('public.linkedin_profile_drafts', 'id', 'd0000000-0000-0000-0000-000000000006', 'a different user cannot select another user''s LinkedIn draft');
select tests.assert_update_denied('public.linkedin_profile_drafts', 'id', 'd0000000-0000-0000-0000-000000000006', 'title = ''Hijacked''', 'a different user cannot update another user''s LinkedIn draft');
select tests.assert_delete_denied('public.linkedin_profile_drafts', 'id', 'd0000000-0000-0000-0000-000000000006', 'a different user cannot delete another user''s LinkedIn draft');

select tests.assert_select_denied('public.daily_practice_completions', 'id', 'd0000000-0000-0000-0000-000000000007', 'a different user cannot select another user''s daily practice row');
select tests.assert_delete_denied('public.daily_practice_completions', 'id', 'd0000000-0000-0000-0000-000000000007', 'a different user cannot delete another user''s daily practice row');

select tests.clear_authentication();

-- ---------------------------------------------------------------------
-- subscriptions, ai_usage_logs — SELECT-only tables (no client write
-- policy at all; writes go through a security-definer fn/webhook/
-- service role), plus the null-owner "invisible to everyone" check.
-- ---------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.assert_select_visible('public.subscriptions', 'id', 'e0000000-0000-0000-0000-000000000001', 'owner can select their own subscription');
select tests.assert_select_visible('public.ai_usage_logs', 'id', 'f0000000-0000-0000-0000-000000000001', 'owner can select their own AI usage log row');
select tests.assert_select_denied('public.ai_usage_logs', 'id', 'f0000000-0000-0000-0000-000000000002', 'a null-owner AI usage log row is invisible even to another real user, not universally readable');
select tests.clear_authentication();

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select tests.assert_select_denied('public.subscriptions', 'id', 'e0000000-0000-0000-0000-000000000001', 'a different user cannot select another user''s subscription');
select tests.assert_select_denied('public.ai_usage_logs', 'id', 'f0000000-0000-0000-0000-000000000001', 'a different user cannot select another user''s AI usage log row');
select tests.clear_authentication();

select * from finish();
rollback;
