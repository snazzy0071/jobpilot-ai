import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricBar } from "@/components/marketing/metric-bar";
import type { InterviewAnswerScore } from "@/lib/interviews/types";

/** One answer's full STAR + relevance/clarity/evidence breakdown — shared by the live chat (shown inline right after the conversation moves past a question) and the results page's per-answer scores section. */
export function ScoreCard({ score }: { score: InterviewAnswerScore }) {
  return (
    <Card className="ml-0 flex max-w-lg flex-col gap-3 bg-muted/30 p-4 sm:mr-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Feedback on that answer</p>
        <Badge variant="secondary">{score.overallScore}/100 overall</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <MetricBar label="Situation" value={score.situationScore} />
        <MetricBar label="Task" value={score.taskScore} />
        <MetricBar label="Action" value={score.actionScore} />
        <MetricBar label="Result" value={score.resultScore} />
        <MetricBar label="Relevance" value={score.relevanceScore} />
        <MetricBar label="Clarity" value={score.clarityScore} />
        <MetricBar label="Evidence" value={score.evidenceScore} />
      </div>

      {score.strengths.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Strengths</p>
          <ul className="list-disc pl-4 text-sm">
            {score.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {score.improvements.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Improve next time</p>
          <ul className="list-disc pl-4 text-sm">
            {score.improvements.map((improvement) => (
              <li key={improvement}>{improvement}</li>
            ))}
          </ul>
        </div>
      )}

      {score.suggestedRephrase && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">A stronger way to say part of it</p>
          <p className="text-sm italic">&ldquo;{score.suggestedRephrase}&rdquo;</p>
        </div>
      )}
    </Card>
  );
}
