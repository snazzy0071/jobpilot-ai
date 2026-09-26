-- How many active questions each active pack has, for the Test Prep catalogue ("10 questions · 15:00 exam"). One row per pack,
-- so the number stays correct as the bank grows instead of being a client-side tally of a capped row list. Security invoker:
-- the public read policies on packs and questions already apply.

create or replace function public.test_prep_pack_counts()
returns table (question_pack_id uuid, question_count bigint)
language sql
stable
as $$
  select q.question_pack_id, count(*) as question_count
  from public.questions q
  join public.question_packs p on p.id = q.question_pack_id
  where q.is_active and p.is_active
  group by q.question_pack_id;
$$;

grant execute on function public.test_prep_pack_counts() to anon, authenticated;
