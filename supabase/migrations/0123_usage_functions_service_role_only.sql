-- Usage metering and rate limiting functions were written as "service role only" (revoke from public; grant to service_role), but
-- Supabase's default privileges give `anon` and `authenticated` EXECUTE on every new function in `public` directly, and revoking
-- from `public` does not remove those. So anyone holding the public anon key (i.e. any visitor) could call them with ANY user id:
--   release_usage(user, metric, period, n)         - refund usage: reset your own counter and use metered features without limit
--   try_consume_usage(user, metric, ..., limit, n) - burn another user's monthly allowance (denial of service against them)
--   increment_subscription_usage(...)              - the same, unconditionally
--   try_consume_rate_limit / try_consume_anonymous_rate_limit - exhaust someone's rate-limit window, or bypass their own
-- They are only ever called from server code with the service-role client (src/lib/entitlements/service.ts, src/lib/ai/*), so
-- removing the client roles' access changes nothing that works today.

revoke execute on function public.release_usage(uuid, text, timestamptz, integer) from anon, authenticated;
revoke execute on function public.try_consume_usage(uuid, text, timestamptz, timestamptz, integer, integer) from anon, authenticated;
revoke execute on function public.increment_subscription_usage(uuid, text, timestamptz, timestamptz, integer) from anon, authenticated;
revoke execute on function public.try_consume_rate_limit(uuid, text, timestamptz, integer) from anon, authenticated;
revoke execute on function public.try_consume_anonymous_rate_limit(text, text, timestamptz, integer) from anon, authenticated;
