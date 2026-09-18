-- Replaces the check-then-record usage pattern with a single atomic
-- consume operation, and adds a new metered entitlement (AI operations)
-- alongside the existing ATS/chat/voice ones.
--
-- The bug this fixes: src/lib/entitlements/service.ts's
-- checkUsageAllowed() (read used_count) and recordUsage() (migration
-- 0018's increment_subscription_usage, an atomic increment) were two
-- separate round trips, called at different times by application code —
-- check, do the gated work, then record. increment_subscription_usage
-- itself can't lose an update, but the *pair* isn't atomic: two
-- concurrent requests from the same user can both call checkUsageAllowed
-- while used_count is still 1 of a limit of 2, both see "allowed", both
-- do the gated work, and both then increment — used_count ends at 3.
-- Two round trips can never close that gap; only one database
-- transaction that checks and increments together can.

-- Atomically checks the limit and increments in one transaction, using a
-- row lock (`for update`) so a concurrent call for the same
-- (user, metric, period) blocks until this one commits, instead of both
-- reading the same stale used_count. This is what actually prevents the
-- race — not the atomicity of the increment alone, which 0018 already
-- had and which wasn't sufficient.
create function public.try_consume_usage(
  p_user_id uuid,
  p_metric text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_limit integer, -- null means unlimited
  p_amount integer default 1
)
returns table(allowed boolean, used_count integer)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_current_count integer;
begin
  -- Ensure a row exists to lock. A concurrent first-ever call for the
  -- same period races here too, but on conflict do nothing means
  -- whichever loses just proceeds to lock the row the winner created —
  -- still correct, no double-insert.
  insert into public.subscription_usage (user_id, metric, period_start, period_end, used_count)
  values (p_user_id, p_metric, p_period_start, p_period_end, 0)
  on conflict (user_id, metric, period_start) do nothing;

  select su.used_count into v_current_count
  from public.subscription_usage su
  where su.user_id = p_user_id and su.metric = p_metric and su.period_start = p_period_start
  for update;

  if p_limit is not null and v_current_count + p_amount > p_limit then
    return query select false, v_current_count;
    return;
  end if;

  update public.subscription_usage
  set used_count = used_count + p_amount, updated_at = now()
  where user_id = p_user_id and metric = p_metric and period_start = p_period_start
  returning subscription_usage.used_count into v_current_count;

  return query select true, v_current_count;
end;
$$;

revoke execute on function public.try_consume_usage(uuid, text, timestamptz, timestamptz, integer, integer) from public;
grant execute on function public.try_consume_usage(uuid, text, timestamptz, timestamptz, integer, integer) to service_role;

-- Compensating decrement for when the gated work itself fails *after*
-- usage was already consumed (e.g. an AI provider call errors out) —
-- refunds the reservation instead of permanently charging for a failure.
-- Clamped at 0 so a duplicate or late release can't push a count
-- negative.
create function public.release_usage(
  p_user_id uuid,
  p_metric text,
  p_period_start timestamptz,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_used_count integer;
begin
  update public.subscription_usage
  set used_count = greatest(0, used_count - p_amount),
      updated_at = now()
  where user_id = p_user_id and metric = p_metric and period_start = p_period_start
  returning used_count into v_used_count;

  return coalesce(v_used_count, 0);
end;
$$;

revoke execute on function public.release_usage(uuid, text, timestamptz, integer) from public;
grant execute on function public.release_usage(uuid, text, timestamptz, integer) to service_role;

-- New metered entitlement: a shared monthly budget for AI-cost
-- operations that don't have their own dedicated counter (cover letter
-- drafts, LinkedIn rewrites, job match runs, grad scheme feedback) —
-- layered on top of those features' existing boolean access flags, not
-- replacing them. Merged in with `||` rather than a full entitlements
-- replace (unlike migration 0016), since this only adds one key to an
-- otherwise-unchanged blob. Initial values, same "configurable" spirit
-- as every other number in this table — tune with a plain UPDATE.
update public.plans set entitlements = entitlements || '{"ai_operations_per_month": 0}'::jsonb where slug = 'free';
update public.plans set entitlements = entitlements || '{"ai_operations_per_month": 10}'::jsonb where slug = 'pro';
update public.plans set entitlements = entitlements || '{"ai_operations_per_month": 30}'::jsonb where slug = 'premium';
update public.plans set entitlements = entitlements || '{"ai_operations_per_month": null}'::jsonb where slug = 'elite';
