-- Backs the "Access code" signup path (institution/employer-provided
-- codes granting free access, redeemed instead of subscribing). No RLS
-- policies are granted to anon/authenticated — validation and redemption
-- happen only through `redeem_access_code()` (security definer) called
-- from the signup Server Action via the service-role client. Nothing here
-- grants any entitlement by itself; that's wired up when billing exists.

create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  max_redemptions integer check (max_redemptions > 0),
  redemption_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;

create table public.access_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references public.access_codes (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now()
);

alter table public.access_code_redemptions enable row level security;

create policy "Users can view their own redemption"
  on public.access_code_redemptions for select
  using (auth.uid() = user_id);

-- Atomically validates and claims a code: the UPDATE's WHERE clause
-- re-checks active/expiry/capacity under row lock, so concurrent
-- redemptions of the last remaining seat can't both succeed. Returns the
-- access_code id on success, null if the code is invalid/exhausted.
create function public.redeem_access_code(p_code text, p_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.access_codes
  set redemption_count = redemption_count + 1
  where code = p_code
    and is_active
    and (expires_at is null or expires_at > now())
    and (max_redemptions is null or redemption_count < max_redemptions)
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  insert into public.access_code_redemptions (access_code_id, user_id)
  values (v_id, p_user_id);

  return v_id;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without
-- this, anyone holding the anon key could call this RPC directly with an
-- arbitrary p_user_id — bypassing signup entirely and burning/hijacking
-- redemptions. Only our service-role Server Action should call it.
revoke execute on function public.redeem_access_code(text, uuid) from public;
grant execute on function public.redeem_access_code(text, uuid) to service_role;
