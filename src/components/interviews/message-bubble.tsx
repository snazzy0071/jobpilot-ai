import type { InterviewTranscriptTurn } from "@/lib/interviews/types";

/** A single chat turn, styled by speaker — shared by the live chat (InterviewChat) and the results page's read-only AnnotatedTranscript, so the two views of the same conversation look identical. */
export function MessageBubble({ turn }: { turn: InterviewTranscriptTurn }) {
  const isInterviewer = turn.speaker === "interviewer";
  return (
    <div className={`flex ${isInterviewer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-lg rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isInterviewer ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {turn.content}
      </div>
    </div>
  );
}
