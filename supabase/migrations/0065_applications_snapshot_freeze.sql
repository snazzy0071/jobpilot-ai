-- Freezes an application's sponsor-state/match-score/submitted-CV
-- snapshot the first time it reaches 'applied' — before that point,
-- sponsor_status (and, once linked to a scored job, match_score) keep
-- reflecting live data on every save, same as migration 0064
-- established; once actually applied, what the user saw and acted on
-- at that moment is the fact worth keeping, not whatever the sponsor
-- register or a re-scored match says today.
--
-- `submitted_cv_version_id` is a new, separate column from the
-- existing `cv_id`: `cv_id` is the live picker selection on the form
-- (can be repointed at a different CV, or the same CV can keep being
-- edited into new versions, at any time) — neither of those should
-- rewrite which *specific* version was actually submitted the moment
-- this application first became real. `frozen_at` is null until that
-- moment, then permanent — it's both the "has this been frozen"
-- signal and the record of when.
--
-- The actual "never overwrite" guarantee is a trigger, not just
-- application-code discipline (src/lib/applications/snapshot.ts is
-- written to never even attempt it, but a DB-level backstop is what
-- makes this a guarantee rather than a convention — same reasoning
-- migration 0051 gave for enforcing profiles.role immutability with a
-- trigger rather than trusting every future call site to remember).
-- Unlike 0051's trigger, this one doesn't raise on a blocked attempt:
-- it silently pins the four snapshot columns back to their frozen
-- values and lets the rest of the update through. 0051 raises because
-- that was a security boundary (privilege escalation) that must fail
-- loudly; this is about preserving historical fidelity on one row
-- whose *other* fields (status, notes, deadline, …) legitimately keep
-- changing after the freeze — rejecting the whole update just because
-- some other field's own recompute would also have touched a frozen
-- column would block those legitimate edits too.

alter table public.applications
  add column submitted_cv_version_id uuid references public.cv_versions (id) on delete set null,
  add column frozen_at timestamptz;

create index applications_submitted_cv_version_id_idx on public.applications (submitted_cv_version_id);

create function public.prevent_application_snapshot_overwrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.frozen_at is not null then
    new.sponsor_status := old.sponsor_status;
    new.match_score := old.match_score;
    new.submitted_cv_version_id := old.submitted_cv_version_id;
    new.frozen_at := old.frozen_at;
  end if;
  return new;
end;
$$;

create trigger prevent_application_snapshot_overwrite
  before update on public.applications
  for each row execute procedure public.prevent_application_snapshot_overwrite();
