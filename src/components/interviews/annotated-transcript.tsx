import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "@/components/interviews/message-bubble";
import { INTERVIEW_COMPETENCY_LABELS } from "@/lib/interviews/types";
import type { InterviewTranscriptTurn, InterviewQuestion, InterviewAnswerScore } from "@/lib/interviews/types";

type TranscriptGroup = {
  questionId: string | null;
  question: InterviewQuestion | null;
  score: InterviewAnswerScore | null;
  turns: InterviewTranscriptTurn[];
};

/** Consecutive turns sharing the same question id (the original question plus any follow-ups on it) collapse into one annotated group — a closing remark (questionId null) gets its own trailing group. */
function groupTranscript(
  transcript: InterviewTranscriptTurn[],
  questions: InterviewQuestion[],
  scores: Record<string, InterviewAnswerScore>,
): TranscriptGroup[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const groups: TranscriptGroup[] = [];

  for (const turn of transcript) {
    const last = groups[groups.length - 1];
    if (last && last.questionId === turn.questionId) {
      last.turns.push(turn);
      continue;
    }
    groups.push({
      questionId: turn.questionId,
      question: turn.questionId ? (questionById.get(turn.questionId) ?? null) : null,
      score: turn.questionId ? (scores[turn.questionId] ?? null) : null,
      turns: [turn],
    });
  }

  return groups;
}

/**
 * The full conversation, read-only, with each question's competency and
 * final score annotated above the exchange it belongs to — the
 * results page's "what actually happened, with context" view, distinct
 * from the per-answer scores section's deeper STAR breakdown.
 */
export function AnnotatedTranscript({
  transcript,
  questions,
  scores,
}: {
  transcript: InterviewTranscriptTurn[];
  questions: InterviewQuestion[];
  scores: Record<string, InterviewAnswerScore>;
}) {
  const groups = groupTranscript(transcript, questions, scores);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.questionId ?? `closing-${index}`} className="flex flex-col gap-2">
          {group.question && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {INTERVIEW_COMPETENCY_LABELS[group.question.competency]}
              </Badge>
              {group.score && (
                <Badge variant="outline" className="text-xs font-normal">
                  {group.score.overallScore}/100
                </Badge>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {group.turns.map((turn) => (
              <MessageBubble key={turn.id} turn={turn} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
