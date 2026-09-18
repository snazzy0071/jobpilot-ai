-- Minimal plan tracking for the app shell's plan badge/upgrade CTA.
-- Deliberately just free/paid — real tier names, pricing, and the
-- actual upgrade flow belong to the not-yet-built Billing module, which
-- can extend this enum (additive) once it exists. Everyone is 'free'
-- today since there's no way to become anything else yet.

create type public.plan as enum ('free', 'paid');

alter table public.profiles
  add column plan public.plan not null default 'free';
