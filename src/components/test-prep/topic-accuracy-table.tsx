import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, TargetIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MIN_SAMPLE_FOR_WEAK, WEAK_ACCURACY_THRESHOLD } from "@/lib/test-prep/selection";
import type { TestPrepInsights } from "@/lib/test-prep/analytics";

type Topic = TestPrepInsights["topics"][number];

const TREND_LABEL = { improving: "Improving", declining: "Slipping", steady: "Steady" } as const;

function TrendBadge({ trend }: { trend: Topic["trend"] }) {
  if (!trend) return <span className="text-xs text-muted-foreground">Not enough recent answers</span>;
  const Icon = trend === "improving" ? ArrowUpRightIcon : trend === "declining" ? ArrowDownRightIcon : MinusIcon;
  return (
    <Badge variant="outline" className={`gap-1 ${trend === "improving" ? "text-primary" : trend === "declining" ? "text-destructive" : ""}`}>
      <Icon className="size-3" aria-hidden="true" /> {TREND_LABEL[trend]}
    </Badge>
  );
}

/**
 * Accuracy by topic (subtype), grouped by test format: how many answered, how many right, the split by difficulty, whether
 * recent practice is better or worse than earlier, and — for any topic with enough answers to judge — whether it counts as
 * a weak area, with a way to drill it. The number is always printed; colour never carries it alone.
 */
export function TopicAccuracyTable({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) {
    return <p className="text-sm text-muted-foreground">Answer a few questions to see your accuracy by topic.</p>;
  }

  const byType = new Map<string, Topic[]>();
  for (const topic of topics) byType.set(topic.testTypeName ?? "Other", [...(byType.get(topic.testTypeName ?? "Other") ?? []), topic]);

  return (
    <div className="flex flex-col gap-4" data-testid="topic-accuracy">
      {[...byType.entries()].map(([typeName, list]) => (
        <Card key={typeName} className="gap-3 p-4">
          <h3 className="text-sm font-semibold">{typeName}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 font-medium">Topic</th>
                  <th scope="col" className="pb-2 font-medium">Accuracy</th>
                  <th scope="col" className="pb-2 font-medium">By difficulty</th>
                  <th scope="col" className="pb-2 font-medium">Trend</th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    <span className="sr-only">Practise</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((topic) => {
                  const weak = topic.total >= MIN_SAMPLE_FOR_WEAK && topic.accuracy < WEAK_ACCURACY_THRESHOLD;
                  return (
                    <tr key={topic.subtype} className="border-t" data-testid="topic-row" data-weak={weak}>
                      <th scope="row" className="py-2 pr-2 text-left font-medium">
                        {topic.subtype}
                        {weak && (
                          <Badge variant="destructive" className="ml-2">
                            Weak area
                          </Badge>
                        )}
                      </th>
                      <td className="py-2 pr-2 tabular-nums">
                        <span className="font-semibold">{topic.accuracy}%</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          ({topic.correct}/{topic.total})
                        </span>
                        {topic.total < MIN_SAMPLE_FOR_WEAK && <span className="ml-1 text-xs text-muted-foreground">· too few to judge</span>}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {topic.byDifficulty.map((entry) => `${entry.difficulty === "unspecified" ? "untagged" : entry.difficulty} ${entry.accuracy}% (${entry.correct}/${entry.total})`).join(" · ")}
                      </td>
                      <td className="py-2 pr-2">
                        <TrendBadge trend={topic.trend} />
                      </td>
                      <td className="py-2 text-right">
                        {topic.testTypeId && (
                          <Button size="sm" variant={weak ? "default" : "outline"} render={<Link href={`/dashboard/test-prep/focus?type=${topic.testTypeId}&subtype=${encodeURIComponent(topic.subtype)}`} />}>
                            <TargetIcon className="size-3.5" /> Practise
                            <span className="sr-only"> {topic.subtype}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
