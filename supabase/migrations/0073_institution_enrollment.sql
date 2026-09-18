-- Wires the three institution-enrollment paths onto migration 0072's
-- schema:
--   1. Access code — access_codes.institution_id has existed since
--      migration 0019 but was never actually consumed; redeem_access_code()
--      now enrolls the caller into institution_members when the code
--      carries one.
--   2. Invitation link — accept_institution_invite() already exists
--      (migration 0072); nothing to add here, only the application layer
--      calling it (src/lib/institutions/enrollment/actions.ts).
--   3. Approved email domain — a new enroll_via_verified_domain(), called
--      both best-effort at signup (handle_new_user()) and on demand from
--      settings for an existing account.
--
-- Also fixes a real concurrency gap in migration 0072's own
-- enforce_institution_seat_capacity(): unlike access_codes' redemption
-- count (a single row, atomically incremented via one UPDATE ... WHERE,
-- so a second concurrent redemption is naturally serialized by that
-- row's own lock), seat capacity here is an aggregate COUNT(*) across
-- two tables — a plain "check, then insert" trigger is a textbook
-- check-then-act race: two simultaneous inserts for the same
-- institution could each read "1 seat left" before either commits, and
-- both succeed, oversubscribing by one. An advisory lock, scoped to the
-- institution and held for the rest of the transaction, serializes
-- exactly this without touching unrelated institutions' concurrent
-- activity or requiring every caller to add its own retry-on-conflict
-- logic.
create or replace function public.enforce_institution_seat_capacity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_seat_count integer;
  v_seats_used integer;
begin
  -- Fixed arbitrary namespace (872321) keeps this lock's keyspace
  -- separate from any unrelated advisory lock this app might add later;
  -- the second key is the actual per-institution serialization point.
  -- pg_advisory_xact_lock auto-releases at transaction end either way.
  perform pg_advisory_xact_lock(872321, hashtext(new.institution_id::text));

  select seat_count into v_seat_count
  from public.institution_licences
  where institution_id = new.institution_id and is_active
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
-- Approved email domain
-- ---------------------------------------------------------------------

-- Resolves the caller's own auth.users.email (never a client-supplied
-- one — this only ever runs server-side, via the service-role client
-- or from within handle_new_user() itself, so there's no way to probe
-- someone else's email against the domain list) and, if it matches a
-- *verified* institution_domains row, enrolls them. `joined` is false
-- (not an error) when the caller already belongs to a different
-- institution — enrolling via a matched domain is an ambient, opt-in
-- convenience, not a deliberate admin action, so it never silently
-- moves an existing membership the way accepting a targeted invite
-- deliberately does (migration 0072's own comment on that).
create function public.enroll_via_verified_domain(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email text;
  v_institution_id uuid;
  v_joined boolean := false;
begin
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
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
-- Best-effort domain auto-enrollment at signup
-- ---------------------------------------------------------------------

-- Unchanged from migration 0015 except the final block: calls
-- enroll_via_verified_domain() for every brand-new user and swallows
-- ANY error from it. This has to be best-effort — an institution at
-- full seat capacity (or any other failure) must never block account
-- creation itself, since handle_new_user() runs inside the same
-- transaction as auth.users' own insert and an uncaught exception here
-- aborts the *entire* signup (profile, preferences, subscription,
-- billing event, none of it — migration 0052's own comment on this
-- exact function covers why). A user whose auto-enrollment attempt
-- fails this way can always retry from settings once seats free up,
-- via the same enroll_via_verified_domain() RPC.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_newsletter_opt_in boolean := coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false);
  v_free_plan_id uuid;
  v_subscription_id uuid;
begin
  insert into public.profiles (id, full_name, date_of_birth, newsletter_opt_in, newsletter_opt_in_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    (new.raw_user_meta_data ->> 'date_of_birth')::date,
    v_newsletter_opt_in,
    case when v_newsletter_opt_in then now() else null end
  );

  insert into public.user_preferences (id)
  values (new.id);

  select id into v_free_plan_id from public.plans where slug = 'free';

  insert into public.subscriptions (user_id, plan_id, status, current_period_start)
  values (new.id, v_free_plan_id, 'active', now())
  returning id into v_subscription_id;

  insert into public.billing_events (user_id, subscription_id, event_type)
  values (new.id, v_subscription_id, 'subscription_created');

  begin
    perform public.enroll_via_verified_domain(new.id);
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Access code → institution enrollment
-- ---------------------------------------------------------------------

-- Unchanged from migration 0019 except: also returns access_codes'
-- institution_id, and — when present — enrolls the caller into
-- institution_members (role 'member'; access codes are a cohort/
-- student mechanism, never how institution-admin rights are granted —
-- that's what an invite with role 'admin' is for). `on conflict
-- (user_id) do nothing`, same "never silently move an existing
-- membership" reasoning enroll_via_verified_domain() above uses.
--
-- Deliberately does NOT wrap this insert in its own exception handler:
-- if the institution is at seat capacity, the raise from
-- enforce_institution_seat_capacity() propagates all the way up
-- uncaught, rolling back this entire function's transaction —
-- including the redemption_count increment and the
-- access_code_redemptions row. A code that fails to redeem this way
-- burns nothing; it's exactly as valid for a later, successful attempt
-- as it was before this one. This is different from
-- handle_new_user()'s own best-effort swallow above because redeeming a
-- code is something the caller explicitly asked to do, not a passive
-- signup-time bonus — a real, honest failure is the right outcome here,
-- not a silent no-op.
--
-- access_code_redemptions.user_id staying globally unique (migration
-- 0005, untouched here) is what already prevents redeeming more than
-- one code ever, or the same code twice, structurally rather than by
-- any client-side check.
create or replace function public.redeem_access_code(p_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_access_code_id uuid;
  v_granted_plan_id uuid;
  v_granted_plan_slug text;
  v_has_paid_stripe_subscription boolean;
  v_institution_id uuid;
  v_institution_joined boolean := false;
begin
  update public.access_codes
  set redemption_count = redemption_count + 1
  where code = p_code
    and is_active
    and (expires_at is null or expires_at > now())
    and (max_redemptions is null or redemption_count < max_redemptions)
  returning id, granted_plan_id, institution_id into v_access_code_id, v_granted_plan_id, v_institution_id;

  if v_access_code_id is null then
    return null;
  end if;

  insert into public.access_code_redemptions (access_code_id, user_id, granted_plan_id)
  values (v_access_code_id, p_user_id, v_granted_plan_id);

  if v_granted_plan_id is not null then
    select (status = 'active' and stripe_subscription_id is not null)
    into v_has_paid_stripe_subscription
    from public.subscriptions
    where user_id = p_user_id;

    if coalesce(v_has_paid_stripe_subscription, false) = false then
      insert into public.subscriptions (user_id, plan_id, status)
      values (p_user_id, v_granted_plan_id, 'active')
      on conflict (user_id) do update
      set plan_id = excluded.plan_id,
          status = excluded.status;

      select slug into v_granted_plan_slug from public.plans where id = v_granted_plan_id;

      insert into public.billing_events (user_id, subscription_id, event_type, metadata)
      select
        p_user_id,
        s.id,
        'subscription_upgraded',
        jsonb_build_object(
          'source', 'access_code',
          'access_code_id', v_access_code_id,
          'plan_slug', v_granted_plan_slug
        )
      from public.subscriptions s
      where s.user_id = p_user_id;
    end if;
  end if;

  if v_institution_id is not null then
    insert into public.institution_members (institution_id, user_id, role)
    values (v_institution_id, p_user_id, 'member')
    on conflict (user_id) do nothing
    returning true into v_institution_joined;
  end if;

  return jsonb_build_object(
    'access_code_id', v_access_code_id,
    'granted_plan_id', v_granted_plan_id,
    'granted_plan_slug', v_granted_plan_slug,
    'institution_id', v_institution_id,
    'institution_joined', coalesce(v_institution_joined, false)
  );
end;
$$;
