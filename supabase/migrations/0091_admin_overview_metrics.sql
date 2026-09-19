-- Aggregate functions behind the /admin overview. The dashboard needs
-- grouped counts and per-day series across a dozen tables; PostgREST
-- can't GROUP BY, and pulling raw rows into the app just to count them
-- would get slower every month. Two functions, one round trip each:
--
--   admin_overview_daily(p_days)   one row per UTC day: signups, active
--                                  users, AI calls/cost, scans, etc.
--   admin_overview_snapshot()      one jsonb document of totals and
--                                  breakdowns (subscriptions by plan and
--                                  status, active users, failures, ...).
--
-- "Active user" is defined once, here: a user who did at least one
-- recorded product action — an AI call, a new CV, ATS scan, interview
-- session, cover letter or application, or an application status
-- change. It's an activity definition, not a sign-in one (Supabase only
-- stamps last_sign_in_at on a fresh sign-in, not on a long-lived
-- session), and it's the same union for the daily series and the
-- 1/7/30-day windows so the two always agree.
--
-- SECURITY DEFINER because the tables are self-select only under RLS;
-- EXECUTE is granted to the service role alone, so the only caller is
-- the admin dashboard's server code (which sits behind requireAdmin()).

create or replace function public.admin_overview_daily(p_days integer default 30)
returns table (
  day date,
  new_users integer,
  active_users integer,
  ai_calls integer,
  ai_failed integer,
  ai_cost_usd numeric,
  ats_scans integer,
  interviews integer,
  cvs_created integer,
  applications_created integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select ((now() at time zone 'utc')::date - (greatest(least(p_days, 366), 1) - 1)) as first_day
  ),
  days as (
    select generate_series((select first_day from bounds), (now() at time zone 'utc')::date, interval '1 day')::date as d
  ),
  activity as (
    select user_id, (created_at at time zone 'utc')::date as d from public.ai_usage_logs
      where user_id is not null and created_at >= (select first_day from bounds)
    union all
    select user_id, (created_at at time zone 'utc')::date from public.cvs
      where created_at >= (select first_day from bounds)
    union all
    select user_id, (created_at at time zone 'utc')::date from public.ats_scans
      where created_at >= (select first_day from bounds)
    union all
    select user_id, (created_at at time zone 'utc')::date from public.interview_sessions
      where created_at >= (select first_day from bounds)
    union all
    select user_id, (created_at at time zone 'utc')::date from public.cover_letters
      where created_at >= (select first_day from bounds)
    union all
    select user_id, (created_at at time zone 'utc')::date from public.applications
      where created_at >= (select first_day from bounds)
    union all
    select user_id, (changed_at at time zone 'utc')::date from public.application_status_history
      where changed_at >= (select first_day from bounds)
  ),
  dau as (select d, count(distinct user_id) as c from activity group by d),
  signups as (
    select (created_at at time zone 'utc')::date as d, count(*) as c
    from public.profiles where created_at >= (select first_day from bounds) group by 1
  ),
  ai as (
    select (created_at at time zone 'utc')::date as d,
           count(*) as calls,
           count(*) filter (where not success) as failed,
           coalesce(sum(estimated_cost_usd), 0) as cost
    from public.ai_usage_logs where created_at >= (select first_day from bounds) group by 1
  ),
  scans as (
    select (created_at at time zone 'utc')::date as d, count(*) as c
    from public.ats_scans where created_at >= (select first_day from bounds) group by 1
  ),
  sessions_d as (
    select (created_at at time zone 'utc')::date as d, count(*) as c
    from public.interview_sessions where created_at >= (select first_day from bounds) group by 1
  ),
  cv as (
    select (created_at at time zone 'utc')::date as d, count(*) as c
    from public.cvs where created_at >= (select first_day from bounds) group by 1
  ),
  apps as (
    select (created_at at time zone 'utc')::date as d, count(*) as c
    from public.applications where created_at >= (select first_day from bounds) group by 1
  )
  select
    days.d,
    coalesce(signups.c, 0)::integer,
    coalesce(dau.c, 0)::integer,
    coalesce(ai.calls, 0)::integer,
    coalesce(ai.failed, 0)::integer,
    coalesce(ai.cost, 0)::numeric,
    coalesce(scans.c, 0)::integer,
    coalesce(sessions_d.c, 0)::integer,
    coalesce(cv.c, 0)::integer,
    coalesce(apps.c, 0)::integer
  from days
  left join dau on dau.d = days.d
  left join signups on signups.d = days.d
  left join ai on ai.d = days.d
  left join scans on scans.d = days.d
  left join sessions_d on sessions_d.d = days.d
  left join cv on cv.d = days.d
  left join apps on apps.d = days.d
  order by days.d;
$$;

create or replace function public.admin_overview_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with activity as (
    select user_id, created_at as at from public.ai_usage_logs
      where user_id is not null and created_at >= now() - interval '30 days'
    union all select user_id, created_at from public.cvs where created_at >= now() - interval '30 days'
    union all select user_id, created_at from public.ats_scans where created_at >= now() - interval '30 days'
    union all select user_id, created_at from public.interview_sessions where created_at >= now() - interval '30 days'
    union all select user_id, created_at from public.cover_letters where created_at >= now() - interval '30 days'
    union all select user_id, created_at from public.applications where created_at >= now() - interval '30 days'
    union all select user_id, changed_at from public.application_status_history where changed_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'active_users', (
      select jsonb_build_object(
        'd1', count(distinct user_id) filter (where at >= now() - interval '1 day'),
        'd7', count(distinct user_id) filter (where at >= now() - interval '7 days'),
        'd30', count(distinct user_id)
      ) from activity
    ),
    'subscriptions', (
      select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb) from (
        select p.slug as plan_slug, p.name as plan_name, p.tier_order,
               p.monthly_price_pence, p.annual_price_pence,
               s.status::text as status, s.billing_cycle::text as billing_cycle,
               count(*)::integer as count
        from public.subscriptions s
        join public.plans p on p.id = s.plan_id
        group by p.slug, p.name, p.tier_order, p.monthly_price_pence, p.annual_price_pence, s.status, s.billing_cycle
      ) g
    ),
    'billing_events_30d', (
      select coalesce(jsonb_object_agg(event_type, c), '{}'::jsonb) from (
        select event_type::text as event_type, count(*)::integer as c
        from public.billing_events
        where created_at >= now() - interval '30 days'
        group by event_type
      ) b
    ),
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'cvs', (select count(*) from public.cvs),
      'cvs_archived', (select count(*) from public.cvs where is_archived),
      'ats_scans', (select count(*) from public.ats_scans),
      'ats_avg_match_30d', (select round(avg(match_score)::numeric, 1) from public.ats_scans where created_at >= now() - interval '30 days'),
      'interviews', (select count(*) from public.interview_sessions),
      'interviews_completed', (select count(*) from public.interview_sessions where status = 'completed'),
      'applications', (select count(*) from public.applications),
      'cover_letters', (select count(*) from public.cover_letters),
      'jobs_active', (select count(*) from public.jobs where is_active and (expires_at is null or expires_at > now()))
    ),
    'applications_by_status', (
      select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) from (
        select status::text as status, count(*)::integer as c from public.applications group by status
      ) a
    ),
    'ai_30d', jsonb_build_object(
      'input_tokens', (select coalesce(sum(input_tokens), 0) from public.ai_usage_logs where created_at >= now() - interval '30 days'),
      'output_tokens', (select coalesce(sum(output_tokens), 0) from public.ai_usage_logs where created_at >= now() - interval '30 days'),
      'top_operations', (
        select coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb) from (
          select operation, count(*)::integer as calls,
                 count(*) filter (where not success)::integer as failed,
                 coalesce(sum(estimated_cost_usd), 0)::float8 as cost_usd
          from public.ai_usage_logs
          where created_at >= now() - interval '30 days'
          group by operation
          order by sum(estimated_cost_usd) desc, count(*) desc
          limit 6
        ) o
      )
    ),
    'institutions', jsonb_build_object(
      'total', (select count(*) from public.institutions),
      'active_licences', (select count(*) from public.institution_licences where is_active and (expires_at is null or expires_at > now())),
      'seats_licensed', (select coalesce(sum(seat_count), 0) from public.institution_licences where is_active and (expires_at is null or expires_at > now())),
      'members', (select count(*) from public.institution_members),
      'expiring_30d', (select count(*) from public.institution_licences where is_active and expires_at is not null and expires_at > now() and expires_at <= now() + interval '30 days')
    ),
    'failures_7d', jsonb_build_object(
      'job_sync', (select count(*) from public.job_imports where status = 'failed' and started_at >= now() - interval '7 days'),
      'sponsor_sync', (select count(*) from public.sponsor_imports where status = 'failed' and started_at >= now() - interval '7 days'),
      'emails', (select count(*) from public.email_send_logs where status = 'failed' and created_at >= now() - interval '7 days'),
      'ai_calls', (select count(*) from public.ai_usage_logs where not success and created_at >= now() - interval '7 days'),
      'payments', (select count(*) from public.billing_events where event_type = 'payment_failed' and created_at >= now() - interval '7 days'),
      'webhooks_unresolved', (select count(distinct stripe_event_id) from public.stripe_webhook_failures where resolved_at is null and created_at >= now() - interval '7 days')
    )
  );
$$;

revoke all on function public.admin_overview_daily(integer) from public, anon, authenticated;
revoke all on function public.admin_overview_snapshot() from public, anon, authenticated;
grant execute on function public.admin_overview_daily(integer) to service_role;
grant execute on function public.admin_overview_snapshot() to service_role;
