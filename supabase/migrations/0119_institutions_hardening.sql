-- Institutions: fixes found while verifying the module end to end (seats, expiry, invites, domains, roles, analytics, tenant RLS).
-- Forward-only; nothing here drops data.
--
-- 1. Seat enforcement ignored licence dates: an EXPIRED licence (is_active still true) kept granting seats. The trigger now only
--    counts a licence that has started and has not expired.
-- 2. Accepting an invite at full capacity always failed: the invite being accepted still counted as a "reserved" seat while its
--    member row was inserted. accept_institution_invite() now closes the invite first, so its own seat is not counted twice.
--    A person who is already a member of the same institution needs no extra seat (upsert, access-code redeem, invite).
-- 3. An invite is bound to the email it was sent to: only that account can accept it (a forwarded link can't hand out admin rights).
-- 4. Domain claims: an institution admin could INSERT a domain with is_verified = true, self-verifying it and pulling every
--    address at that domain into their tenant. Claims must now arrive unverified; only a JobPilot admin verifies.
--    Domain enrolment also requires a CONFIRMED email address, so nobody can sign up as someone@university.ac.uk to get a seat.
-- 5. Roster privacy: a plain member could read the whole roster (user ids and who the admins are). Members now see only their own
--    row; institution admins see their whole institution; JobPilot admins see everything.
-- 6. Institution admins can no longer INSERT membership rows themselves (people join by invite, code or verified domain, all of
--    which run server-side); they also cannot re-point a membership at another user or rename the tenant's slug.
-- 7. profiles.role = 'institution_admin' now follows institution_members.role automatically (promotion by the in-app role
--    switch previously left the person without access; demotion/removal left a stale role).
-- 8. Analytics: get_institution_analytics() withholds the activity counts for a cohort smaller than 5 students, because with one
--    or two students an "aggregate" is a single person's private activity.
-- 9. get_institution_licence_plan(): the plan an institution's licence gives one of its members, used by the entitlement service.

-- ---------------------------------------------------------------------
-- 1 + 2. Seat capacity
-- ---------------------------------------------------------------------

create or replace function public.enforce_institution_seat_capacity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_seat_count integer;
  v_seats_used integer;
begin
  perform pg_advisory_xact_lock(872321, hashtext(new.institution_id::text));

  -- Someone who already holds a seat here doesn't need another one (the row is an upsert that leaves them where they are).
  if tg_table_name = 'institution_members' and exists (
    select 1 from public.institution_members m where m.user_id = new.user_id and m.institution_id = new.institution_id
  ) then
    return new;
  end if;

  select seat_count into v_seat_count
  from public.institution_licences
  where institution_id = new.institution_id
    and is_active
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_seat_count is null then
    raise exception 'This institution has no active licence.' using errcode = '23514';
  end if;

  select
    (select count(*) from public.institution_members where institution_id = new.institution_id)
    + (select count(*) from public.institution_invites where institution_id = new.institution_id and accepted_at is null and expires_at > now())
  into v_seats_used;

  if v_seats_used >= v_seat_count then
    raise exception 'No seats remaining on this institution''s licence.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2 + 3. Invite acceptance
-- ---------------------------------------------------------------------

create or replace function public.accept_institution_invite(p_token_hash text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_invite public.institution_invites%rowtype;
  v_email text;
  v_existing public.institution_members%rowtype;
  v_role public.institution_member_role;
begin
  select * into v_invite
  from public.institution_invites
  where token_hash = p_token_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if v_invite.id is null then
    return null;
  end if;

  -- Only the person the invite was sent to. Same "invalid" answer as a bad token, so this can't be used to probe.
  select lower(email) into v_email from auth.users where id = p_user_id;
  if v_email is null or v_email <> v_invite.email then
    return null;
  end if;

  select * into v_existing from public.institution_members where user_id = p_user_id;

  -- Close the invite first so its own reserved seat is not counted again by the seat trigger below.
  update public.institution_invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = v_invite.id;

  if v_existing.id is not null and v_existing.institution_id = v_invite.institution_id then
    -- Already here: never demote an existing admin through a member invite.
    v_role := case when v_existing.role = 'admin' or v_invite.role = 'admin' then 'admin' else 'member' end;
    update public.institution_members set role = v_role where id = v_existing.id;
  else
    v_role := v_invite.role;
    insert into public.institution_members (institution_id, user_id, role)
    values (v_invite.institution_id, p_user_id, v_role)
    on conflict (user_id) do update
    set institution_id = excluded.institution_id,
        role = excluded.role,
        joined_at = now();
  end if;

  -- (profiles.role is kept in step by sync_institution_admin_profile_role below.)
  return jsonb_build_object('institution_id', v_invite.institution_id, 'role', v_role);
end;
$$;

revoke execute on function public.accept_institution_invite(text, uuid) from public;
grant execute on function public.accept_institution_invite(text, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. Domains
-- ---------------------------------------------------------------------

drop policy "Institution admins can claim domains" on public.institution_domains;
create policy "Institution admins can claim domains"
  on public.institution_domains for insert
  with check (
    (is_verified = false and public.is_institution_member_admin(institution_domains.institution_id))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.enroll_via_verified_domain(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_institution_id uuid;
  v_joined boolean := false;
begin
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = p_user_id;
  -- An unconfirmed address proves nothing about who owns it.
  if v_email is null or v_confirmed is null then
    return jsonb_build_object('matched', false);
  end if;

  select institution_id into v_institution_id
  from public.institution_domains
  where domain = split_part(lower(v_email), '@', 2) and is_verified
  limit 1;

  if v_institution_id is null then
    return jsonb_build_object('matched', false);
  end if;

  insert into public.institution_members (institution_id, user_id, role)
  values (v_institution_id, p_user_id, 'member')
  on conflict (user_id) do nothing
  returning true into v_joined;

  return jsonb_build_object('matched', true, 'institution_id', v_institution_id, 'joined', coalesce(v_joined, false));
end;
$$;

revoke execute on function public.enroll_via_verified_domain(uuid) from public;
grant execute on function public.enroll_via_verified_domain(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 5 + 6. Roster privacy and membership writes
-- ---------------------------------------------------------------------

drop policy "Institution members can view their own institution's roster" on public.institution_members;
create policy "Members see their own row, institution admins their roster"
  on public.institution_members for select
  using (
    user_id = auth.uid()
    or public.is_institution_member_admin(institution_members.institution_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy "Institution admins can add members" on public.institution_members;
create policy "Only JobPilot admins add members directly"
  on public.institution_members for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.protect_institution_member_identity()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id and current_user in ('anon', 'authenticated') then
    raise exception 'A membership cannot be reassigned to another user.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_institution_member_identity
  before update on public.institution_members
  for each row execute procedure public.protect_institution_member_identity();

create or replace function public.protect_institution_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug and current_user in ('anon', 'authenticated')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only JobPilot can change an institution''s slug.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_institution_slug
  before update on public.institutions
  for each row execute procedure public.protect_institution_slug();

-- ---------------------------------------------------------------------
-- 7. profiles.role follows institution_members.role
-- ---------------------------------------------------------------------

create or replace function public.sync_institution_admin_profile_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.role = 'admin' then
    update public.profiles set role = 'institution_admin' where id = new.user_id and role = 'user';
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.role = 'admin' and (new.role <> 'admin' or new.user_id <> old.user_id)) then
    if not exists (select 1 from public.institution_members m where m.user_id = old.user_id and m.role = 'admin') then
      update public.profiles set role = 'user' where id = old.user_id and role = 'institution_admin';
    end if;
  end if;

  return null;
end;
$$;

create trigger sync_institution_admin_profile_role
  after insert or update or delete on public.institution_members
  for each row execute procedure public.sync_institution_admin_profile_role();

-- Repair existing rows: an admin membership whose profile is still 'user', and an 'institution_admin' profile with no admin membership.
update public.profiles p set role = 'institution_admin'
where p.role = 'user' and exists (select 1 from public.institution_members m where m.user_id = p.id and m.role = 'admin');
update public.profiles p set role = 'user'
where p.role = 'institution_admin' and not exists (select 1 from public.institution_members m where m.user_id = p.id and m.role = 'admin');

-- ---------------------------------------------------------------------
-- 8. Analytics: no activity counts for a tiny cohort
-- ---------------------------------------------------------------------

create or replace function public.get_institution_analytics(p_institution_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  c_min_cohort constant integer := 5;
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

  if v_member_count < c_min_cohort then
    return jsonb_build_object(
      'studentCount', v_member_count, 'activatedStudents', 0, 'cvsBuilt', 0, 'atsScans', 0, 'interviewsCompleted', 0,
      'applicationsTracked', 0, 'testSessionsCompleted', 0, 'suppressed', true, 'minCohort', c_min_cohort
    );
  end if;

  select count(*) into v_cvs_built
  from public.cvs c join public.institution_members m on m.user_id = c.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_ats_scans
  from public.ats_scans a join public.institution_members m on m.user_id = a.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_interviews_completed
  from public.interview_sessions i join public.institution_members m on m.user_id = i.user_id
  where m.institution_id = p_institution_id and m.role = 'member' and i.status = 'completed';

  select count(*) into v_applications_tracked
  from public.applications ap join public.institution_members m on m.user_id = ap.user_id
  where m.institution_id = p_institution_id and m.role = 'member';

  select count(*) into v_test_sessions_completed
  from public.test_sessions ts join public.institution_members m on m.user_id = ts.user_id
  where m.institution_id = p_institution_id and m.role = 'member' and ts.completed_at is not null;

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
    'testSessionsCompleted', v_test_sessions_completed,
    'suppressed', false,
    'minCohort', c_min_cohort
  );
end;
$$;

revoke execute on function public.get_institution_analytics(uuid) from public;
grant execute on function public.get_institution_analytics(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 9. The plan a member gets from their institution's licence
-- ---------------------------------------------------------------------

create function public.get_institution_licence_plan(p_user_id uuid)
returns jsonb
language sql
security definer set search_path = ''
stable
as $$
  select jsonb_build_object('slug', p.slug, 'name', p.name, 'entitlements', p.entitlements, 'institutionId', m.institution_id)
  from public.institution_members m
  join public.institution_licences l on l.institution_id = m.institution_id
  join public.plans p on p.id = l.plan_id
  where m.user_id = p_user_id
    and l.is_active
    and l.starts_at <= now()
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

revoke execute on function public.get_institution_licence_plan(uuid) from public;
grant execute on function public.get_institution_licence_plan(uuid) to service_role;
