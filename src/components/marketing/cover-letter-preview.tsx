import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Line } from "@/components/marketing/wireframe-line";

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Check className="size-3.5 shrink-0 text-primary" />
      <span>{label}</span>
    </div>
  );
}

/** An illustrative cover letter layout — a mockup for marketing, not a real screenshot. */
export function CoverLetterPreview() {
  return (
    <Card className="mx-auto w-full max-w-sm gap-4 p-6">
      <p className="text-sm font-medium">Dear Hiring Manager,</p>

      <div className="flex flex-col gap-2">
        <Line width="full" />
        <Line width="full" />
        <Line width="3/4" />
      </div>

      <div className="flex flex-col gap-2">
        <Line width="full" />
        <Line width="1/2" />
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Checklist</p>
        <ChecklistItem label="Action verbs" />
        <ChecklistItem label="Quantified results" />
        <ChecklistItem label="Spelling & grammar" />
      </div>
    </Card>
  );
}
