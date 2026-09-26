-- The signed-in user's answer history per question: their most recent result and when, and how many times they've seen it.
-- Used to choose what to serve next — the daily five and focused practice prefer questions never seen, then ones last got
-- wrong, then the ones answered longest ago — instead of a blind random draw that repeats questions you already know.
-- Security invoker: test_answers' own policy scopes it to the caller. One row per question (the bank is a few hundred
-- questions), so PostgREST's row cap is not a concern.

create or replace function public.test_prep_question_history()
returns table (question_id uuid, last_correct boolean, last_answered_at timestamptz, attempts bigint)
language sql
stable
as $$
  select distinct on (a.question_id)
    a.question_id,
    a.is_correct as last_correct,
    a.answered_at as last_answered_at,
    count(*) over (partition by a.question_id) as attempts
  from public.test_answers a
  where a.question_id is not null and a.is_correct is not null
  order by a.question_id, a.answered_at desc;
$$;

grant execute on function public.test_prep_question_history() to authenticated;
