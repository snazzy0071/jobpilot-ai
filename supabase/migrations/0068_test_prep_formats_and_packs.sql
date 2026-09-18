-- Adds the "firm/sector-style" theming migration 0067 didn't have yet,
-- then seeds five real test_types (one per format actually asked for
-- — critical thinking in the Watson-Glaser *style*, situational
-- judgement, numerical, verbal, diagrammatic) and one real,
-- original question_pack + a handful of original questions per type.
--
-- "Watson-Glaser style" here names the well-established, decades-old
-- critical-thinking pedagogy (rating an inference True/Probably True/
-- Insufficient Data/Probably False/False) that this app's own
-- CLAUDE.md already uses as the reference point for what to build an
-- *equivalent* of — not a claim of affiliation with, or a copy of, the
-- actual commercial Watson Glaser product. Every passage, scenario,
-- number, and answer below is original, written for this migration,
-- checked against no publisher's real test content, format, or
-- copyrighted wording. `sector_style` is a free-text label
-- (deliberately not an enum — an app-defined, evolving theme like
-- graduate_schemes.alias_type, not a fixed external taxonomy) naming
-- the *kind* of employer a pack is themed around (e.g. "Consulting"),
-- never a real publisher's or firm's own branded test name.
--
-- Diagrammatic reasoning is represented with plain Unicode symbols/
-- numbers directly in `prompt` rather than image assets — this
-- schema has no image/diagram column yet, and adding real visual
-- diagrams is genuine follow-up scope, not something to half-build
-- here. A symbol/number sequence is still a real, gradeable
-- diagrammatic-style pattern-completion question, just text-rendered.
--
-- Seeded rows have `created_by = null` (the column's own default) —
-- this is system-seeded reference content, not authored by any one
-- admin account that's guaranteed to exist in every environment,
-- same reasoning job_sources' seeded 'manual' row (migration 0059)
-- has no owning admin either.

alter table public.question_packs
  add column sector_style text check (char_length(sector_style) <= 100);

-- ---------------------------------------------------------------------
-- test_types
-- ---------------------------------------------------------------------

insert into public.test_types (slug, name, description) values
  ('critical-thinking', 'Critical Thinking (Watson-Glaser style)', 'Practice rating the strength of inferences, assumptions, and arguments from a short passage — original scenarios, in the style of the well-known critical-thinking assessment format.'),
  ('situational-judgement', 'Situational Judgement', 'Practice choosing the most appropriate response to realistic workplace scenarios.'),
  ('numerical-reasoning', 'Numerical Reasoning', 'Practice interpreting figures, percentages, and simple financial data under exam-style conditions.'),
  ('verbal-reasoning', 'Verbal Reasoning', 'Practice judging whether a statement is true, false, or can''t be determined from a short passage.'),
  ('diagrammatic-reasoning', 'Diagrammatic Reasoning', 'Practice spotting the rule behind a sequence of shapes or numbers and predicting what comes next.');

-- ---------------------------------------------------------------------
-- question_packs (one per type, each themed with a real sector_style)
-- ---------------------------------------------------------------------

insert into public.question_packs (test_type_id, slug, name, description, sector_style, time_limit_seconds)
select id, 'assessing-inferences', 'Critical Thinking: Assessing Inferences', 'Rate how strongly a short passage supports each inference.', 'Consulting', 600
from public.test_types where slug = 'critical-thinking';

insert into public.question_packs (test_type_id, slug, name, description, sector_style, time_limit_seconds)
select id, 'graduate-programme-scenarios', 'Workplace Scenarios: Graduate Programme', 'Choose the most appropriate response to realistic early-career workplace situations.', 'Investment Banking', 600
from public.test_types where slug = 'situational-judgement';

insert into public.question_packs (test_type_id, slug, name, description, sector_style, time_limit_seconds)
select id, 'data-interpretation', 'Numerical Reasoning: Data Interpretation', 'Percentages, growth, and simple profit calculations from short data scenarios.', 'Accounting & Audit', 600
from public.test_types where slug = 'numerical-reasoning';

insert into public.question_packs (test_type_id, slug, name, description, sector_style, time_limit_seconds)
select id, 'passage-analysis', 'Verbal Reasoning: Passage Analysis', 'True, False, or Cannot Say questions based on a short passage.', 'Law', 600
from public.test_types where slug = 'verbal-reasoning';

insert into public.question_packs (test_type_id, slug, name, description, sector_style, time_limit_seconds)
select id, 'sequences-and-patterns', 'Diagrammatic Reasoning: Sequences & Patterns', 'Spot the rule behind a sequence and predict what comes next.', 'Technology', 600
from public.test_types where slug = 'diagrammatic-reasoning';

-- ---------------------------------------------------------------------
-- questions — critical-thinking / assessing-inferences
-- ---------------------------------------------------------------------

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Passage: "A mid-sized retail chain reports that stores which introduced self-checkout kiosks saw an 8% rise in average transaction speed, but also a 15% rise in reported stock discrepancies over the same quarter." Statement: "Self-checkout kiosks caused the rise in stock discrepancies." How should this inference be rated, based only on the passage?',
  '["True", "Probably True", "Insufficient Data", "Probably False", "False"]'::jsonb,
  'Insufficient Data',
  'The two figures occurred in the same quarter in the same stores, but the passage never establishes that one caused the other — other factors could explain the discrepancy rise.',
  1
from public.question_packs where slug = 'assessing-inferences';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Same passage as above. Statement: "The rise in transaction speed was measured in stores that introduced self-checkout kiosks." How should this inference be rated, based only on the passage?',
  '["True", "Probably True", "Insufficient Data", "Probably False", "False"]'::jsonb,
  'True',
  'The passage directly states this was measured in stores that introduced the kiosks.',
  2
from public.question_packs where slug = 'assessing-inferences';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Same passage as above. Statement: "Self-checkout kiosks are a net negative for this retail chain overall." How should this inference be rated, based only on the passage?',
  '["True", "Probably True", "Insufficient Data", "Probably False", "False"]'::jsonb,
  'Insufficient Data',
  'The passage gives two isolated metrics with no overall cost-benefit comparison, so an overall judgement can''t be drawn from it alone.',
  3
from public.question_packs where slug = 'assessing-inferences';

-- ---------------------------------------------------------------------
-- questions — situational-judgement / graduate-programme-scenarios
-- ---------------------------------------------------------------------

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'You are a graduate analyst nearing a client deadline. A senior colleague asks you to include a figure in the report that you calculated differently, but you are confident your own calculation is correct. What is the most appropriate action?',
  '["Change the figure to match what the senior colleague expects without further discussion.", "Politely explain your calculation method and ask them to check it with you before the report goes out.", "Submit the report with your own figure without mentioning the discrepancy.", "Ask a different colleague to decide which figure is correct."]'::jsonb,
  'Politely explain your calculation method and ask them to check it with you before the report goes out.',
  'Raising the discrepancy directly and collaboratively resolves it before the deadline, without silently overriding a senior colleague or hiding a genuine concern.',
  1
from public.question_packs where slug = 'graduate-programme-scenarios';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Midway through a group case study exercise, you notice a teammate has misunderstood a key instruction and is heading in the wrong direction with their section. What should you do?',
  '["Let them continue and correct it yourself later without saying anything.", "Point out the misunderstanding to the group as soon as it''s convenient, so it can be fixed together.", "Report it to the assessor immediately.", "Say nothing, since it''s their responsibility."]'::jsonb,
  'Point out the misunderstanding to the group as soon as it''s convenient, so it can be fixed together.',
  'Raising it constructively and promptly addresses the issue while it''s still fixable and supports the team''s overall result.',
  2
from public.question_packs where slug = 'graduate-programme-scenarios';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'You receive conflicting feedback from two mentors on how to approach a task. What is the best first step?',
  '["Follow whichever mentor is more senior without further thought.", "Ask each mentor to clarify their reasoning, then decide which approach best fits the task''s actual requirements.", "Ignore both and do it your own way.", "Avoid the task until the mentors agree."]'::jsonb,
  'Ask each mentor to clarify their reasoning, then decide which approach best fits the task''s actual requirements.',
  'Understanding the reasoning behind each suggestion lets you make an informed decision, rather than defaulting to seniority or avoiding the task.',
  3
from public.question_packs where slug = 'graduate-programme-scenarios';

-- ---------------------------------------------------------------------
-- questions — numerical-reasoning / data-interpretation
-- ---------------------------------------------------------------------

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'A firm''s quarterly expenses were: Q1 £120,000, Q2 £135,000, Q3 £150,000, Q4 £165,000. What was the percentage increase in expenses from Q1 to Q4?',
  '["25%", "37.5%", "45%", "52%"]'::jsonb,
  '37.5%',
  '(£165,000 − £120,000) ÷ £120,000 × 100 = 37.5%.',
  1
from public.question_packs where slug = 'data-interpretation';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'A company''s revenue grew from £2.4 million to £3.0 million over one year. Costs grew from £1.8 million to £2.1 million over the same period. By how much did profit (revenue minus costs) increase?',
  '["£300,000", "£600,000", "£900,000", "£1,200,000"]'::jsonb,
  '£300,000',
  'Profit rose from £0.6m (£2.4m − £1.8m) to £0.9m (£3.0m − £2.1m), an increase of £300,000.',
  2
from public.question_packs where slug = 'data-interpretation';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Out of 240 audits completed last year, 15% were flagged for follow-up review. How many audits were flagged?',
  '["24", "30", "36", "42"]'::jsonb,
  '36',
  '240 × 0.15 = 36.',
  3
from public.question_packs where slug = 'data-interpretation';

-- ---------------------------------------------------------------------
-- questions — verbal-reasoning / passage-analysis
-- ---------------------------------------------------------------------

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Passage: "A recent change to workplace policy at a mid-sized law firm requires all client correspondence above a specified value threshold to be reviewed by a second qualified solicitor before being sent. The firm''s managing partner stated the change was introduced after a small number of drafting errors were identified in high-value client communications over the previous year." Statement: "The new policy applies to all client correspondence, regardless of value." True, False, or Cannot Say?',
  '["True", "False", "Cannot Say"]'::jsonb,
  'False',
  'The passage states the policy applies only above a specified value threshold, not to all correspondence.',
  1
from public.question_packs where slug = 'passage-analysis';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Same passage as above. Statement: "Drafting errors had never occurred at the firm before the previous year." True, False, or Cannot Say?',
  '["True", "False", "Cannot Say"]'::jsonb,
  'Cannot Say',
  'The passage only describes errors identified in the previous year — it says nothing about whether errors occurred, or were noticed, before that.',
  2
from public.question_packs where slug = 'passage-analysis';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Same passage as above. Statement: "The policy change was a direct response to identified drafting errors." True, False, or Cannot Say?',
  '["True", "False", "Cannot Say"]'::jsonb,
  'True',
  'The passage directly attributes the policy change to errors identified in high-value communications.',
  3
from public.question_packs where slug = 'passage-analysis';

-- ---------------------------------------------------------------------
-- questions — diagrammatic-reasoning / sequences-and-patterns
-- ---------------------------------------------------------------------

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Which symbol continues this sequence? △ ▢ △ ▢ △ ?',
  '["△", "▢", "○", "◇"]'::jsonb,
  '▢',
  'The sequence strictly alternates between △ and ▢ — after three complete alternations ending on △, the pattern continues with ▢.',
  1
from public.question_packs where slug = 'sequences-and-patterns';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'What number continues this sequence? 2, 4, 8, 16, ?',
  '["24", "28", "30", "32"]'::jsonb,
  '32',
  'Each number doubles the previous one: 16 × 2 = 32.',
  2
from public.question_packs where slug = 'sequences-and-patterns';

insert into public.questions (question_pack_id, question_type, prompt, options, correct_answer, explanation, display_order)
select id, 'multiple_choice',
  'Which continues the pattern? ○, ○○, ○○○, ○○○○, ?',
  '["○○○○○", "○○○○", "○○○", "○○"]'::jsonb,
  '○○○○○',
  'Each term has one more circle than the last (1, 2, 3, 4 → 5).',
  3
from public.question_packs where slug = 'sequences-and-patterns';
