import { Card } from "@/components/ui/card";
import { MetricBar } from "@/components/marketing/metric-bar";

/** An illustrative ATS score breakdown — a mockup for marketing, not a real scan result. */
export function AtsScorePreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-5 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-sm font-medium">Your CV match</p>
        <p className="text-2xl font-semibold text-primary">
          78<span className="text-sm font-normal text-muted-foreground">/100</span>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <MetricBar label="Keyword match" value={82} />
        <MetricBar label="Structure" value={90} />
        <MetricBar label="Formatting" value={100} />
        <MetricBar label="Sections" value={65} />
      </div>
    </Card>
  );
}
