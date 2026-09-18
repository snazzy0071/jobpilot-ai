-- Atomic increment for subscription_usage. The entitlement service's
-- recordUsage() calls this instead of a read-then-write from application
-- code, which would race under concurrent requests — two simultaneous
-- calls could both read used_count=1 and both write 2, losing a count.
-- Same reasoning as redeem_access_code() in migration 0005: a
-- security-definer function makes the increment atomic in the database
-- itself, not in application code that can interleave.
create function public.increment_subscription_usage(
  p_user_id uuid,
  p_metric text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_used_count integer;
begin
  insert into public.subscription_usage (user_id, metric, period_start, period_end, used_count)
  values (p_user_id, p_metric, p_period_start, p_period_end, p_amount)
  on conflict (user_id, metric, period_start)
  do update set used_count = public.subscription_usage.used_count + excluded.used_count,
                updated_at = now()
  returning used_count into v_used_count;

  return v_used_count;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without
-- this, anyone holding the anon key could call this RPC directly with an
-- arbitrary p_user_id, incrementing (or resetting the count on) someone
-- else's usage. Only trusted server-side code (the service-role client)
-- should call it.
revoke execute on function public.increment_subscription_usage(uuid, text, timestamptz, timestamptz, integer) from public;
grant execute on function public.increment_subscription_usage(uuid, text, timestamptz, timestamptz, integer) to service_role;
