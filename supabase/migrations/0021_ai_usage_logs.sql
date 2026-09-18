-- Token/cost logging for the AI service (src/lib/ai/). One row per
-- Claude API call, successful or not, so cost and failure rate are both
-- visible — not just successes. Written only by the service-role client
-- (src/lib/ai/logging.ts), same access model as billing_events: a user
-- can see their own usage for transparency, but nothing here is
-- client-writable.

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  -- Nullable + on delete set null: losing the log row entirely when an
  -- account is deleted would erase real cost history; the log should
  -- outlive the user reference, not cascade with it.
  user_id uuid references auth.users (id) on delete set null,
  operation text not null check (char_length(operation) <= 100),
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  -- Estimated from src/lib/ai/config.ts's pricing table, not Anthropic's
  -- own billing — good enough for relative cost tracking/alerting, not
  -- a substitute for the real invoice.
  estimated_cost_usd numeric(10, 6) not null default 0,
  success boolean not null,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_logs enable row level security;

create policy "Users can view their own AI usage"
  on public.ai_usage_logs for select
  using (auth.uid() = user_id);

create index ai_usage_logs_user_id_idx on public.ai_usage_logs (user_id);
create index ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at desc);
