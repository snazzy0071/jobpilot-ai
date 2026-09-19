import { Card } from "@/components/ui/card";
import { MetricBar } from "@/components/marketing/metric-bar";
import { Counter } from "@/components/motion/counter";

/** An illustrative ATS score breakdown — a mockup for marketing, not a real scan result. */
export function AtsScorePreview() {
  return (
    <Card variant="metric" className="mx-auto w-full max-w-sm gap-5 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-sm font-medium">Your CV match</p>
        <p className="text-2xl font-semibold text-primary">
          <Counter value={78} />
          <span className="text-sm font-normal text-muted-foreground">/100</span>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <MetricBar label="Keyword match" value={82} delay={0.1} />
        <MetricBar label="Structure" value={90} delay={0.2} />
        <MetricBar label="Formatting" value={100} delay={0.3} />
        <MetricBar label="Sections" value={65} delay={0.4} />
      </div>
    </Card>
  );
}
