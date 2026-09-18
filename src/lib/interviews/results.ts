import type { InterviewQuestion, InterviewAnswerScore, InterviewCompetency, InterviewCompetencyBreakdownEntry } from "@/lib/interviews/types";

/** Averages each competency's per-question overall_score across every question in the session that targeted it — a competency can come up more than once in a 5-8 question session, so this is a real average, not just a list. Questions with no score yet (still in progress) are skipped. */
export function computeCompetencyBreakdown(
  questions: InterviewQuestion[],
  scores: Record<string, InterviewAnswerScore>,
): InterviewCompetencyBreakdownEntry[] {
  const totals = new Map<InterviewCompetency, { sum: number; count: number }>();

  for (const question of questions) {
    const score = scores[question.id];
    if (!score) continue;
    const existing = totals.get(question.competency) ?? { sum: 0, count: 0 };
    existing.sum += score.overallScore;
    existing.count += 1;
    totals.set(question.competency, existing);
  }

  return Array.from(totals.entries()).map(([competency, { sum, count }]) => ({
    competency,
    score: Math.round(sum / count),
  }));
}

const WEAK_COMPETENCY_THRESHOLD = 70;

/** The competencies worth re-practising — below the threshold, weakest first, so "Practice weak areas" targets what actually needs work rather than the whole session again. */
export function getWeakCompetencies(breakdown: InterviewCompetencyBreakdownEntry[]): InterviewCompetency[] {
  return breakdown
    .filter((entry) => entry.score < WEAK_COMPETENCY_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.competency);
}
