// What to serve next. Pure (no database, no randomness of its own — the caller passes a `random` function), so it is
// unit-tested and so a session's questions are chosen by one documented rule rather than a blind draw.
//
// The rule: prefer questions you have NEVER seen, then ones you last got WRONG, then ones answered longest ago; within
// that, prefer topics (subtypes) you are currently weak in; break remaining ties randomly. A blind random draw would keep
// repeating questions a learner already knows and bury the ones they need.

export type Candidate = { id: string; testTypeId: string; subtype: string | null };
export type QuestionHistory = { lastCorrect: boolean; lastAnsweredAt: string };

/** 0 = never seen, 1 = last answered wrong, 2 = last answered right. */
export function priorityTier(history: QuestionHistory | undefined): 0 | 1 | 2 {
  if (!history) return 0;
  return history.lastCorrect ? 2 : 1;
}

function rank(
  candidate: Candidate,
  histories: Map<string, QuestionHistory>,
  weakSubtypes: Set<string>,
  random: () => number,
): [number, number, number, number] {
  const history = histories.get(candidate.id);
  const tier = priorityTier(history);
  const weak = weakSubtypes.has(candidate.subtype ?? "General") ? 0 : 1;
  // Older answers first inside the "seen" tiers; unseen questions have no time to order by.
  const age = history ? new Date(history.lastAnsweredAt).getTime() : 0;
  return [tier, weak, age, random()];
}

function compare(a: [number, number, number, number], b: [number, number, number, number]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Best-first ordering of a candidate list. */
export function orderByPriority(
  candidates: Candidate[],
  histories: Map<string, QuestionHistory>,
  weakSubtypes: Set<string>,
  random: () => number = Math.random,
): Candidate[] {
  return candidates
    .map((candidate) => ({ candidate, key: rank(candidate, histories, weakSubtypes, random) }))
    .sort((a, b) => compare(a.key, b.key))
    .map((entry) => entry.candidate);
}

/**
 * The daily five: one question from each test type (so a day always mixes formats), the best-ranked available for that
 * type. If a type has no questions the gap is filled from the best remaining candidates overall. Returns question ids
 * in test-type order, at most `size` of them.
 */
export function pickDaily(
  candidates: Candidate[],
  histories: Map<string, QuestionHistory>,
  weakSubtypes: Set<string>,
  size = 5,
  random: () => number = Math.random,
): string[] {
  const ordered = orderByPriority(candidates, histories, weakSubtypes, random);
  const typeIds = [...new Set(candidates.map((candidate) => candidate.testTypeId))].sort();
  const chosen: Candidate[] = [];
  for (const typeId of typeIds) {
    if (chosen.length >= size) break;
    const best = ordered.find((candidate) => candidate.testTypeId === typeId);
    if (best) chosen.push(best);
  }
  for (const candidate of ordered) {
    if (chosen.length >= size) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  return chosen.map((candidate) => candidate.id);
}

/** Focused practice on one topic: the best-ranked `size` questions of that topic. */
export function pickFocus(
  candidates: Candidate[],
  histories: Map<string, QuestionHistory>,
  size = 10,
  random: () => number = Math.random,
): string[] {
  return orderByPriority(candidates, histories, new Set(), random)
    .slice(0, size)
    .map((candidate) => candidate.id);
}

/** Subtype accuracy at or under this (with enough answers) counts as a weak area. */
export const WEAK_ACCURACY_THRESHOLD = 70;
/** Answers needed on a topic before it can be called weak — three lucky/unlucky answers say little. */
export const MIN_SAMPLE_FOR_WEAK = 5;
