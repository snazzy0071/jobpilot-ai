-- Admin: the Plans/Subscriptions and Auto-Apply pages, and a correction to the MRR figure.
--
-- 1. Two new admin permissions, granted to super_admin like every earlier one.
-- 2. admin_subscription_breakdown(): subscriptions grouped by plan, status, billing cycle AND whether a Stripe subscription
--    stands behind them. admin_overview_snapshot() grouped without that last column, so a "paid" plan given free (an access code, a
--    complimentary grant) was counted as revenue. MRR and "paying" must only count subscriptions Stripe actually bills.
-- 3. admin_auto_apply_overview(): aggregate counts only for the admin Auto-Apply page - no user, job or CV is ever returned.
-- Both functions are for the server (service role) only: default privileges would otherwise let the anon key call them.

update public.admin_roles
set permissions = permissions || '["view_plans"]'::jsonb
where slug = 'super_admin' and not (permissions ? 'view_plans');

update public.admin_roles
set permissions = permissions || '["view_auto_apply"]'::jsonb
where slug = 'super_admin' and not (permissions ? 'view_auto_apply');

create function public.admin_subscription_breakdown()
returns jsonb
language sql
security definer set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb)
  from (
    select p.slug as plan_slug, p.name as plan_name, p.tier_order,
           p.monthly_price_pence, p.annual_price_pence,
           s.status::text as status, s.billing_cycle::text as billing_cycle,
           (s.stripe_subscription_id is not null) as stripe_billed,
           count(*)::integer as count
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    group by p.slug, p.name, p.tier_order, p.monthly_price_pence, p.annual_price_pence, s.status, s.billing_cycle, (s.stripe_subscription_id is not null)
  ) g;
$$;

create function public.admin_auto_apply_overview()
returns jsonb
language sql
security definer set search_path = ''
stable
as $$
  select jsonb_build_object(
    'users_with_settings', (select count(*) from public.auto_apply_settings),
    'enabled', (select count(*) from public.auto_apply_settings where enabled),
    'paused', (select count(*) from public.auto_apply_settings where enabled and paused),
    'consented', (select count(*) from public.auto_apply_settings where consent_at is not null),
    'users_with_queue', (select count(distinct user_id) from public.auto_apply_queue),
    'queue_by_status', (select coalesce(jsonb_object_agg(status::text, c), '{}'::jsonb) from (select status, count(*)::integer as c from public.auto_apply_queue group by status) q),
    'queued_30d', (select count(*) from public.auto_apply_queue where created_at >= now() - interval '30 days'),
    'approved_30d', (select count(*) from public.auto_apply_queue where approved_at >= now() - interval '30 days'),
    'applied_30d', (select count(*) from public.auto_apply_queue where applied_at >= now() - interval '30 days'),
    'by_adapter', (select coalesce(jsonb_object_agg(adapter, c), '{}'::jsonb) from (select adapter, count(*)::integer as c from public.auto_apply_queue where adapter is not null group by adapter) a),
    'events_7d', (select coalesce(jsonb_object_agg(event, c), '{}'::jsonb) from (select event, count(*)::integer as c from public.auto_apply_events where created_at >= now() - interval '7 days' group by event) e)
  );
$$;

revoke execute on function public.admin_subscription_breakdown() from public, anon, authenticated;
revoke execute on function public.admin_auto_apply_overview() from public, anon, authenticated;
grant execute on function public.admin_subscription_breakdown() to service_role;
grant execute on function public.admin_auto_apply_overview() to service_role;
