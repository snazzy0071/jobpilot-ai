"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importQuestions, type ImportQuestionsResult } from "@/lib/test-prep/admin/actions";

const EXAMPLE = `[
  {
    "questionType": "multiple_choice",
    "subtype": "Percentages",
    "difficulty": "easy",
    "prompt": "A £80 item is reduced by 25%. What is the sale price?",
    "options": ["£55", "£60", "£65", "£70"],
    "correctAnswer": "£60",
    "explanation": "25% of £80 is £20, so the price is £80 − £20 = £60."
  }
]`;

/**
 * Bulk import: paste a JSON array, "Check" runs the same validation the single-question form uses (a dry run that saves
 * nothing and lists every problem by question number), then "Import" adds them all — or none, if anything is wrong.
 */
export function QuestionImportForm({ questionPackId }: { questionPackId: string }) {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [result, setResult] = useState<ImportQuestionsResult | null>(null);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "check" : "import");
    setResult(null);
    const response = await importQuestions({ questionPackId, json, dryRun });
    setBusy(null);
    setResult(response);
    if ("imported" in response && !response.dryRun) {
      router.push(`/admin/test-prep/packs/${questionPackId}`);
      router.refresh();
    }
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-json">Questions (JSON array)</Label>
          <Textarea id="import-json" rows={16} className="font-mono text-xs" value={json} onChange={(event) => { setJson(event.target.value); setResult(null); }} placeholder={EXAMPLE} maxLength={1_000_000} />
          <p className="text-xs text-muted-foreground">
            Up to 200 per import. Fields: questionType, prompt, options, correctAnswer, explanation, subtype, difficulty, stimulus, exhibit, optionFigures, isActive. Questions are added to the end of the pack.
          </p>
        </div>

        {result && "error" in result && (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive" data-testid="import-errors">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertCircleIcon className="size-4 shrink-0" /> {result.error}
            </p>
            {result.details && (
              <ul className="list-disc pl-9">
                {result.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result && "valid" in result && result.dryRun && (
          <p role="status" className="flex items-center gap-1.5 text-sm" data-testid="import-ok">
            <CheckCircle2Icon className="size-4 text-primary" /> All {result.valid} question{result.valid === 1 ? " is" : "s are"} valid. Nothing has been saved yet.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" disabled={busy !== null || !json.trim()} onClick={() => void run(true)}>
            {busy === "check" ? <><Loader2Icon className="animate-spin" /> Checking…</> : "Check"}
          </Button>
          <Button type="button" disabled={busy !== null || !json.trim()} onClick={() => void run(false)}>
            {busy === "import" ? <><Loader2Icon className="animate-spin" /> Importing…</> : "Import"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
