import Link from "next/link";
import { FlameIcon, TargetIcon, TimerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AccuracyPoint } from "@/lib/test-prep/analytics";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Every completed session, most recent first. Each opens a full review — your answers, the answer key and the explanations. */
export function SessionsHistoryTable({ history }: { history: AccuracyPoint[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed practice sessions yet.</p>;
  }

  const rows = [...history].reverse();

  return (
    <Card className="divide-y p-0" data-testid="session-history">
      {rows.map((session) => (
        <Link key={session.sessionId} href={`/dashboard/test-prep/history/${session.sessionId}`} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none" data-testid="session-history-row">
          <div className="flex items-center gap-2">
            {session.isDaily ? <FlameIcon className="size-4 shrink-0 text-primary" aria-hidden="true" /> : session.mode === "timed" ? <TimerIcon className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <TargetIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <div>
              <p className="text-sm font-medium">{session.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(session.completedAt)}
                {session.testTypeName ? ` · ${session.testTypeName}` : ""}
                {session.mode === "timed" ? " · timed exam" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {session.correctCount}/{session.totalQuestions} correct
            </span>
            <Badge variant="outline">{session.score}%</Badge>
            <span className="text-xs text-primary">Review</span>
          </div>
        </Link>
      ))}
    </Card>
  );
}
