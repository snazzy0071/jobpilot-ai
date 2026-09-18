-- Traces a logged AI call back to the exact versioned prompt
-- (src/lib/ai/prompts/) that produced it, not just the "operation" label
-- — so if a prompt's wording or schema changes, past results can still
-- be attributed to whichever version actually generated them. Nullable:
-- system-initiated or ungated calls made before this column existed, or
-- ones not backed by a versioned prompt definition, simply omit it.

alter table public.ai_usage_logs
  add column prompt_version text;
