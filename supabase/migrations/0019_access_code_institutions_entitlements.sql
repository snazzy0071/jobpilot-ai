-- Extends access_codes (migration 0005) with the three things its own
-- comment said were still missing: an institution link, and — the real
-- point — actually granting an entitlement on redemption instead of
-- just recording that one happened. Expiry and seat limits already
-- existed (`expires_at`, `max_redemptions`/`redemption_count`); this
-- doesn't touch either.

-- Deliberately minimal: just enough for access_codes to link to
-- something real. Institution-admin accounts aren't linked to a specific
-- institution row yet (no profiles.institution_id or equivalent) — that,
-- and any institution-facing dashboard, is the not-yet-built
-- Institutions module, not this task.
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.institutions enable row level security;
-- No select policy for anon/authenticated, same as access_codes itself —
-- there's no legitimate reason for a client to read this table directly
-- yet. Revisit once institution-admin accounts are actually scoped to one.

alter table public.access_codes
  add column institution_id uuid references public.institutions (id),
  -- Nullable rather than not null: a code with no granted_plan_id still
  -- works exactly like before this migration (redemption is recorded,
  -- nothing about the user's plan changes) — this is what makes the
  -- change additive instead of a breaking assumption about every
  -- existing/future row always specifying a plan.
  add column granted_plan_id uuid references public.plans (id);

-- Snapshot of what was actually granted at redemption time, independent
-- of whatever access_codes.granted_plan_id says *now* — an access code's
-- configured plan could change after the fact; the history shouldn't.
alter table public.access_code_redemptions
  add column granted_plan_id uuid references public.plans (id);

-- Return type changes from uuid to jsonb (richer result: which plan was
-- actually granted, if any) — CREATE OR REPLACE can't change an existing
-- function's return type, so this drops and recreates it. Grants don't
-- survive that, hence the revoke/grant at the bottom re-applying exactly
-- what migration 0005 set up.
drop function if exists public.redeem_access_code(text, uuid);

create function public.redeem_access_code(p_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_access_code_id uuid;
  v_granted_plan_id uuid;
  v_granted_plan_slug text;
  v_has_paid_stripe_subscription boolean;
begin
  -- Unchanged from 0005: the UPDATE's WHERE clause re-checks
  -- active/expiry/capacity under row lock, so concurrent redemptions of
  -- the last remaining seat can't both succeed.
  update public.access_codes
  set redemption_count = redemption_count + 1
  where code = p_code
    and is_active
    and (expires_at is null or expires_at > now())
    and (max_redemptions is null or redemption_count < max_redemptions)
  returning id, granted_plan_id into v_access_code_id, v_granted_plan_id;

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

    -- Never let a redeemed code downgrade or otherwise interfere with an
    -- active, real (Stripe-billed) subscription. The redemption above is
    -- still recorded either way, for accurate seat/history accounting —
    -- only the plan assignment is skipped.
    if coalesce(v_has_paid_stripe_subscription, false) = false then
      -- Upsert, not a plain update: handle_new_user() always creates a
      -- subscriptions row for a brand-new signup before this function
      -- runs, but this function could plausibly be called for an
      -- existing user later too (e.g. redeeming a code from settings) —
      -- a plain UPDATE would silently affect zero rows if one somehow
      -- didn't exist, granting nothing with no error.
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

  return jsonb_build_object(
    'access_code_id', v_access_code_id,
    'granted_plan_id', v_granted_plan_id,
    'granted_plan_slug', v_granted_plan_slug
  );
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without
-- this, anyone holding the anon key could call this RPC directly with an
-- arbitrary p_user_id — bypassing signup entirely and granting
-- themselves (or anyone) a paid plan for free. Only our service-role
-- Server Action should call it — this is the "securely" in "implement
-- signup redemption and entitlement assignment securely": the client
-- never specifies which plan to grant, only which code it entered: the
-- plan comes from access_codes.granted_plan_id, resolved entirely
-- server-side inside this function.
revoke execute on function public.redeem_access_code(text, uuid) from public;
grant execute on function public.redeem_access_code(text, uuid) to service_role;
