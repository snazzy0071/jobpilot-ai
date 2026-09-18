import type { InterviewTranscriptTurn } from "@/lib/interviews/types";

/** Rebuilds the conversation as plain text for the AI prompt — Claude has no memory between calls, so every turn's context is reconstructed from the persisted transcript rather than relying on any client-side or server-side session state. */
export function formatTranscriptForPrompt(turns: InterviewTranscriptTurn[]): string {
  return turns.map((turn) => `${turn.speaker === "interviewer" ? "Interviewer" : "Candidate"}: ${turn.content}`).join("\n");
}
