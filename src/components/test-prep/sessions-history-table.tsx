import { FlameIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AccuracyPoint } from "@/lib/test-prep/analytics";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Every completed session, most recent first — the plain list behind the accuracy-trend chart above it. */
export function SessionsHistoryTable({ history }: { history: AccuracyPoint[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed practice sessions yet.</p>;
  }

  const rows = [...history].reverse();

  return (
    <Card className="divide-y p-0">
      {rows.map((session) => (
        <div key={session.sessionId} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            {session.isDaily && <FlameIcon className="size-4 shrink-0 text-primary" />}
            <div>
              <p className="text-sm font-medium">{session.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(session.completedAt)}
                {session.testTypeName ? ` · ${session.testTypeName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {session.correctCount}/{session.totalQuestions} correct
            </span>
            <Badge variant="outline">{session.score}%</Badge>
          </div>
        </div>
      ))}
    </Card>
  );
}
