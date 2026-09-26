-- These institution functions were written as "service-role only" (revoke from public; grant to service_role), but Supabase's default
-- privileges give `anon` and `authenticated` EXECUTE on every new function in `public` directly, and `revoke ... from public` does not
-- remove those. So anyone holding the public anon key could call them with any user or institution id:
--   get_institution_analytics    - aggregate figures for ANY institution
--   get_institution_licence_plan - which institution / plan ANY user has
--   enroll_via_verified_domain   - enrol ANY user into a matching institution
--   accept_institution_invite    - accept an invite as ANY user id (given a token hash)
--   redeem_access_code           - redeem a code for ANY user id
-- They are only ever called from server code with the service-role client, so removing the client roles' access changes nothing
-- that works today. (Row-level-security helper functions such as is_institution_member are meant for `authenticated` and are untouched.)

revoke execute on function public.get_institution_analytics(uuid) from anon, authenticated;
revoke execute on function public.get_institution_licence_plan(uuid) from anon, authenticated;
revoke execute on function public.enroll_via_verified_domain(uuid) from anon, authenticated;
revoke execute on function public.accept_institution_invite(text, uuid) from anon, authenticated;
revoke execute on function public.redeem_access_code(text, uuid) from anon, authenticated;
