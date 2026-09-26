-- Test Prep results are written only by the server.
--
-- 0067/0071 let a signed-in user write their own rows in test_sessions, test_answers, daily_practice_completions and
-- practice_progress ("for all" policies). Those rows ARE the product's record — the score, whether an answer was right,
-- a timed exam's deadline, a streak day — so anyone with their own login token could call the Supabase REST API directly and
-- write themselves a perfect score, push a timed session's expires_at out, or add streak days without answering anything.
--
-- Now users may only READ their own rows. Every write goes through the Server Actions in src/lib/test-prep/, which use the
-- service-role client (it bypasses RLS) after checking the plan, ownership, the pinned question set and the deadline.
-- Update/delete attempts by a user now match no policy, so they change nothing (the cross-user isolation tests still hold).

drop policy "Users manage their own test sessions" on public.test_sessions;
create policy "Users read their own test sessions"
  on public.test_sessions for select
  using (auth.uid() = user_id);

drop policy "Users manage their own test answers" on public.test_answers;
create policy "Users read their own test answers"
  on public.test_answers for select
  using (auth.uid() = user_id);

drop policy "Users manage their own daily practice completions" on public.daily_practice_completions;
create policy "Users read their own daily practice completions"
  on public.daily_practice_completions for select
  using (auth.uid() = user_id);

drop policy "Users manage their own practice progress" on public.practice_progress;
create policy "Users read their own practice progress"
  on public.practice_progress for select
  using (auth.uid() = user_id);
