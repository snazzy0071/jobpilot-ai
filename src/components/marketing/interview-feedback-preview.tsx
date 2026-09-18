import { Card } from "@/components/ui/card";
import { MetricBar } from "@/components/marketing/metric-bar";

/** An illustrative session feedback summary — a mockup for marketing, not a real session. */
export function InterviewFeedbackPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-5 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-sm font-medium">Session feedback</p>
        <p className="text-xs text-muted-foreground">5 questions</p>
      </div>
      <div className="flex flex-col gap-3">
        <MetricBar label="Clarity" value={74} />
        <MetricBar label="Structure" value={88} />
        <MetricBar label="Keywords" value={65} />
        <MetricBar label="Relevance" value={91} />
      </div>
    </Card>
  );
}
