-- Rate limiting for AI operations with no account behind them at all
-- (Quick Scan: no login, no card — src/lib/quick-scan/) — a parallel
-- mechanism to migration 0022's `ai_rate_limit_windows`, which is keyed
-- by `user_id` (`not null references auth.users`) and so structurally
-- cannot represent "no user". Generalized to `(scope, key_value,
-- window_start)` instead of `(user_id, operation, window_start)`, since
-- the "key" here is a normalized email or an IP address, not a user —
-- and because Quick Scan needs two independent windows over two
-- different keys (an email-scoped calendar-month cap and an IP-scoped
-- short-window cap), a generic scope/key pair covers both without two
-- near-duplicate tables.

create table public.anonymous_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (char_length(scope) <= 50),
  key_value text not null check (char_length(key_value) <= 320),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  unique (scope, key_value, window_start)
);

alter table public.anonymous_rate_limits enable row level security;
-- No select/insert/update policy for anon/authenticated, same stance as
-- ai_rate_limit_windows — written only by the atomic RPC below via the
-- service-role client. There is no user to scope a "view your own" policy
-- to in the first place.

create index anonymous_rate_limits_scope_key_idx on public.anonymous_rate_limits (scope, key_value);

-- Same atomic check-and-increment shape as try_consume_rate_limit
-- (migration 0022) and try_consume_usage (migration 0020): a row lock
-- via SELECT ... FOR UPDATE closes the check-then-act race so two
-- concurrent requests for the same scope/key/window can't both read a
-- stale count and both be let through.
create function public.try_consume_anonymous_rate_limit(
  p_scope text,
  p_key_value text,
  p_window_start timestamptz,
  p_max_requests integer
)
returns table(allowed boolean, request_count integer)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_current_count integer;
begin
  insert into public.anonymous_rate_limits (scope, key_value, window_start, request_count)
  values (p_scope, p_key_value, p_window_start, 0)
  on conflict (scope, key_value, window_start) do nothing;

  select r.request_count into v_current_count
  from public.anonymous_rate_limits r
  where r.scope = p_scope and r.key_value = p_key_value and r.window_start = p_window_start
  for update;

  if v_current_count + 1 > p_max_requests then
    return query select false, v_current_count;
    return;
  end if;

  -- `t.` qualification on both sides of SET is required, not cosmetic:
  -- this function's own `returns table(..., request_count integer)`
  -- implicitly declares a same-named variable in scope, which an
  -- unqualified `request_count` here would be genuinely ambiguous with
  -- (a real "column reference is ambiguous" error at execution time,
  -- not just a style nit — caught by actually running this, not by it
  -- failing to parse at CREATE time).
  update public.anonymous_rate_limits as t
  set request_count = t.request_count + 1
  where t.scope = p_scope and t.key_value = p_key_value and t.window_start = p_window_start
  returning t.request_count into v_current_count;

  return query select true, v_current_count;
end;
$$;

revoke execute on function public.try_consume_anonymous_rate_limit(text, text, timestamptz, integer) from public;
grant execute on function public.try_consume_anonymous_rate_limit(text, text, timestamptz, integer) to service_role;
