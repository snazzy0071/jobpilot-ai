-- Short-window rate limiting for AI calls — abuse/burst protection,
-- distinct from and independent of plan-based monthly usage
-- entitlements (subscription_usage / migration 0015+0020). A user could
-- be well within their monthly "ai_operations_per_month" allowance and
-- still fire requests fast enough to hammer the Anthropic API or run up
-- cost in a way no plan limit alone would catch in time.

create table public.ai_rate_limit_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation text not null check (char_length(operation) <= 100),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, operation, window_start)
);

alter table public.ai_rate_limit_windows enable row level security;
-- No select/insert/update policy for anon/authenticated, same stance as
-- subscription_usage — written only by the atomic RPC below via the
-- service-role client.

create index ai_rate_limit_windows_user_id_idx on public.ai_rate_limit_windows (user_id);

-- TODO: this table has no automatic cleanup — a row per (user, operation,
-- window) accumulates forever. Fine for now (rows are tiny and RLS keeps
-- them invisible to clients), but a periodic delete of windows older
-- than a day or two belongs in whatever cron/scheduled-job mechanism
-- this project eventually adopts.

-- Same atomic check-and-increment shape as try_consume_usage (migration
-- 0020): a row lock via SELECT ... FOR UPDATE closes the same
-- check-then-act race — two concurrent requests in the same window
-- can't both read a stale count and both be let through.
create function public.try_consume_rate_limit(
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

  update public.ai_rate_limit_windows
  set request_count = request_count + 1
  where user_id = p_user_id and operation = p_operation and window_start = p_window_start
  returning ai_rate_limit_windows.request_count into v_current_count;

  return query select true, v_current_count;
end;
$$;

revoke execute on function public.try_consume_rate_limit(uuid, text, timestamptz, integer) from public;
grant execute on function public.try_consume_rate_limit(uuid, text, timestamptz, integer) to service_role;

-- Defense in depth alongside the application-level truncation in
-- src/lib/ai/service.ts's classifyError: even if a future code path
-- forgot to truncate, the database itself won't accept an unbounded
-- error message — one more layer against a large chunk of request/
-- response data accidentally ending up in a log row.
alter table public.ai_usage_logs
  add constraint ai_usage_logs_error_message_length check (error_message is null or char_length(error_message) <= 500);
