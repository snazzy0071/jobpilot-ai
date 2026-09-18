import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function AnswerPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{label}</span>
  );
}

/**
 * An illustrative practice question — original, invented for this mockup.
 * Not copied from any test provider; just the generic "does the conclusion
 * follow from the statement" logic format used across critical-thinking
 * practice materials generally.
 */
export function GradPrepPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-4 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <Badge variant="secondary">Critical Thinking</Badge>
        <span className="text-xs text-muted-foreground">Question 3 of 5</span>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Every volunteer who finishes the induction is added to the roster. Sam finished the
          induction.
        </p>
        <p className="text-sm font-medium">Conclusion: Sam was added to the roster.</p>
        <div className="flex flex-wrap gap-2">
          <AnswerPill label="Follows" />
          <AnswerPill label="Does not follow" />
          <AnswerPill label="Cannot say" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Flame className="size-3.5 text-primary" />
          4-day streak
        </span>
        <span>Accuracy: 78%</span>
      </div>
    </Card>
  );
}
