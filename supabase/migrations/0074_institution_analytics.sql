-- Privacy-safe institution analytics: activated students, CVs built,
-- ATS scans, completed interviews, tracked applications, and completed
-- test-prep sessions — every one of these an *aggregate count* across
-- the institution's own student cohort (institution_members with
-- role = 'member'; institution admin/staff accounts are excluded from
-- these usage stats on purpose, since they measure student activity,
-- not staff poking around the product), never a per-student breakdown.
--
-- Why this has to be a security definer function rather than the
-- regular RLS-respecting client: cvs/ats_scans/interview_sessions/
-- applications/test_sessions all have plain `auth.uid() = user_id`
-- RLS with no admin-visibility carve-out anywhere — there's no way for
-- an institution admin's own authenticated session to read even a
-- COUNT of another member's rows, since RLS filters at the row level
-- before any aggregation happens. This function reads across every
-- member's rows via `security definer`, the same reasoning
-- redeem_access_code/accept_institution_invite already establish for
-- "needs to act across more than the caller's own rows" — but unlike
-- those, this never returns anything but pre-aggregated counts: no
-- row-level data, no user_id, no name, no per-student number, ever
-- leaves this function. That's what makes it privacy-safe by
-- construction rather than by the caller's own discipline — even a
-- careless caller can't turn this into a per-student report, because
-- the shape it returns doesn't have one.
--
-- Deliberately does NOT itself check whether the caller actually
-- administers `p_institution_id` — same trust boundary every other
-- institution-admin action in this app already relies on
-- (src/lib/institutions/admin/actions.ts): requireInstitutionAdmin()
-- resolves `institutionId` server-side before any of these ever get
-- called, and only the service-role client is granted execute below.
create function public.get_institution_analytics(p_institution_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_member_count integer;
  v_activated_count integer;
  v_cvs_built integer;
  v_ats_scans integer;
  v_interviews_completed integer;
  v_applications_tracked integer;
  v_test_sessions_completed integer;
begin
  select count(*) into v_member_count
  from public.institution_members
  where institution_id = p_institution_id and role = 'member';

  select count(*) into v_cvs_built
  from public.cvs c
  join public.institution_members m on m.user_id = c.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_ats_scans
  from public.ats_scans a
  join public.institution_members m on m.user_id = a.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_interviews_completed
  from public.interview_sessions i
  join public.institution_members m on m.user_id = i.user_id
  where m.institution_id = p_institution_id and m.role = 'member' and i.status = 'completed';

  select count(*) into v_applications_tracked
  from public.applications ap
  join public.institution_members m on m.user_id = ap.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_test_sessions_completed
  from public.test_sessions ts
  join public.institution_members m on m.user_id = ts.user_id
  where m.institution_id = p_institution_id and m.role = 'member' and ts.completed_at is not null;

  -- "Activated" = has done at least one of the above, ever — the one
  -- place a per-member fact (did *this* member do anything) feeds into
  -- the result, and even here it only ever contributes to a single
  -- count, never a name or a list.
  select count(*) into v_activated_count
  from public.institution_members m
  where m.institution_id = p_institution_id
    and m.role = 'member'
    and (
      exists (select 1 from public.cvs c where c.user_id = m.user_id)
      or exists (select 1 from public.ats_scans a where a.user_id = m.user_id)
      or exists (select 1 from public.interview_sessions i where i.user_id = m.user_id and i.status = 'completed')
      or exists (select 1 from public.applications ap where ap.user_id = m.user_id)
      or exists (select 1 from public.test_sessions ts where ts.user_id = m.user_id and ts.completed_at is not null)
    );

  return jsonb_build_object(
    'studentCount', v_member_count,
    'activatedStudents', v_activated_count,
    'cvsBuilt', v_cvs_built,
    'atsScans', v_ats_scans,
    'interviewsCompleted', v_interviews_completed,
    'applicationsTracked', v_applications_tracked,
    'testSessionsCompleted', v_test_sessions_completed
  );
end;
$$;

revoke execute on function public.get_institution_analytics(uuid) from public;
grant execute on function public.get_institution_analytics(uuid) to service_role;
