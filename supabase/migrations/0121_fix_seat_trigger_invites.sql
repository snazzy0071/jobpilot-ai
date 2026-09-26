-- 0119's seat trigger read NEW.user_id in an expression that also runs for institution_invites, which has no such column
-- ("record new has no field user_id"), so every invite insert failed. Same function, with the member-only check nested so the field
-- is only touched for institution_members rows.
create or replace function public.enforce_institution_seat_capacity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_seat_count integer;
  v_seats_used integer;
begin
  perform pg_advisory_xact_lock(872321, hashtext(new.institution_id::text));

  if tg_table_name = 'institution_members' then
    -- Someone who already holds a seat here doesn't need another one (the row is an upsert that leaves them where they are).
    if exists (select 1 from public.institution_members m where m.user_id = new.user_id and m.institution_id = new.institution_id) then
      return new;
    end if;
  end if;

  select seat_count into v_seat_count
  from public.institution_licences
  where institution_id = new.institution_id
    and is_active
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_seat_count is null then
    raise exception 'This institution has no active licence.' using errcode = '23514';
  end if;

  select
    (select count(*) from public.institution_members where institution_id = new.institution_id)
    + (select count(*) from public.institution_invites where institution_id = new.institution_id and accepted_at is null and expires_at > now())
  into v_seats_used;

  if v_seats_used >= v_seat_count then
    raise exception 'No seats remaining on this institution''s licence.' using errcode = '23514';
  end if;

  return new;
end;
$$;
