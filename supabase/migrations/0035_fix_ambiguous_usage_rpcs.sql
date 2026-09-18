-- Fixes a real bug in try_consume_usage (migration 0020) and
-- try_consume_rate_limit (migration 0022): both declare a
-- `returns table(...)` output column with the same name as the real
-- table column they update (`used_count`, `request_count`), which
-- PL/pgSQL treats as an implicitly-declared variable in scope — an
-- unqualified reference to that name anywhere in an SQL statement inside
-- the function body is genuinely ambiguous between the two.
--
-- This is a *runtime* error, not a syntax one: Postgres doesn't resolve
-- column/variable references at CREATE FUNCTION time, only when the
-- function body actually executes — so neither function ever failed to
-- be created, they simply throw "column reference ... is ambiguous" the
-- moment either is actually called. That never happened against a real
-- Postgres connection anywhere in this project so far — every prior
-- migration this session was verified via pglite at the schema/
-- constraint level, never by actually invoking these two RPCs, and no
-- live Supabase project has been connected. Found while building
-- try_consume_anonymous_rate_limit (migration 0034), an analogous new
-- function that hit the identical error immediately when pglite-tested
-- by really calling it — which is what prompted checking whether the
-- two functions it was modelled on shared the same latent bug. They did:
-- confirmed by calling both directly against pglite before writing this
-- fix, not assumed from reading the code alone.
--
-- `create or replace function` keeps each original migration's own
-- `revoke`/`grant` intact — permissions attach to the function's
-- name+signature, not its body — so only the body changes here.

create or replace function public.try_consume_usage(
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

  update public.subscription_usage as t
  set used_count = t.used_count + p_amount, updated_at = now()
  where t.user_id = p_user_id and t.metric = p_metric and t.period_start = p_period_start
  returning t.used_count into v_current_count;

  return query select true, v_current_count;
end;
$$;

create or replace function public.try_consume_rate_limit(
  p_user_id uuid,
  p_operation text,
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
  insert into public.ai_rate_limit_windows (user_id, operation, window_start, request_count)
  values (p_user_id, p_operation, p_window_start, 0)
  on conflict (user_id, operation, window_start) do nothing;

  select w.request_count into v_current_count
  from public.ai_rate_limit_windows w
  where w.user_id = p_user_id and w.operation = p_operation and w.window_start = p_window_start
  for update;

  if v_current_count + 1 > p_max_requests then
    return query select false, v_current_count;
    return;
  end if;

  update public.ai_rate_limit_windows as t
  set request_count = t.request_count + 1
  where t.user_id = p_user_id and t.operation = p_operation and t.window_start = p_window_start
  returning t.request_count into v_current_count;

  return query select true, v_current_count;
end;
$$;
