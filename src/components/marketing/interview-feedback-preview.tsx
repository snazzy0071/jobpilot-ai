import { Card } from "@/components/ui/card";
import { MetricBar } from "@/components/marketing/metric-bar";

/** An illustrative session feedback summary — a mockup for marketing, not a real session. */
export function InterviewFeedbackPreview() {
  return (
    <Card variant="metric" className="mx-auto w-full max-w-sm gap-5 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-sm font-medium">Session feedback</p>
        <p className="text-xs text-muted-foreground">5 questions</p>
      </div>
      <div className="flex flex-col gap-3">
        <MetricBar label="Clarity" value={74} delay={0.1} />
        <MetricBar label="Structure" value={88} delay={0.2} />
        <MetricBar label="Keywords" value={65} delay={0.3} />
        <MetricBar label="Relevance" value={91} delay={0.4} />
      </div>
    </Card>
  );
}
