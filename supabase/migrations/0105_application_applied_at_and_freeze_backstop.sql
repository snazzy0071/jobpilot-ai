-- Job tracker: two things the application code had been trusted to do and the database now guarantees.
--
--   * applied_at (the date the application was first submitted) existed since 0063 but nothing ever set it, so the
--     tracker had no "applied on" date to show. It is now stamped the first time an application reaches Applied.
--   * The snapshot freeze (0065) only stops a frozen snapshot being overwritten; setting it in the first place was left
--     to the app. If any code path moved an application to Applied without freezing it (a future action, a direct
--     update), the snapshot would stay live forever. The database now freezes it: the first time status becomes
--     'applied', frozen_at is set if the caller hasn't. The sponsor state / match score / CV version already on the
--     row at that moment are what get frozen — the app still resolves them fresh just before (snapshot.ts), this only
--     guarantees the freeze itself cannot be skipped.
--
-- Both are BEFORE triggers that only fill blanks, so they compose with 0065's overwrite guard (which runs first, by
-- name, and leaves an unfrozen row alone).

create or replace function public.stamp_application_applied()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'applied' then
    if new.applied_at is null then
      new.applied_at := (now() at time zone 'Europe/London')::date;
    end if;
    if new.frozen_at is null then
      new.frozen_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_application_applied on public.applications;
create trigger stamp_application_applied
  before insert or update of status on public.applications
  for each row execute procedure public.stamp_application_applied();

-- Existing rows that already reached Applied get their date from the status history (the first time they got there).
update public.applications a
set applied_at = (h.first_applied at time zone 'Europe/London')::date
from (
  select application_id, min(changed_at) as first_applied
  from public.application_status_history
  where to_status = 'applied'
  group by application_id
) h
where h.application_id = a.id and a.applied_at is null;
