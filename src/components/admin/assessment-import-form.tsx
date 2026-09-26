"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importAssessmentMappings, type AssessmentImportResult } from "@/lib/graduate-schemes/assessment-actions";
import { ASSESSMENT_CSV_HEADER } from "@/lib/graduate-schemes/assessment-schemas";
import { ASSESSMENT_TYPES } from "@/lib/graduate-schemes/types";

// Placeholder values only, to show the shape of a row — never real scheme data.
const EXAMPLE = ["Example Employer", "Example Graduate Programme", "numerical", "", "", "yes", "", "https://example.com/graduates/selection", "2026-01-15", "2026-01-20"].join(",");

export function AssessmentImportForm() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [result, setResult] = useState<AssessmentImportResult | null>(null);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "check" : "import");
    setResult(null);
    const response = await importAssessmentMappings(csvText, { dryRun });
    setBusy(null);
    setResult(response);
    if (!dryRun && "createdCount" in response) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-3 p-6">
        <p className="text-sm font-medium">Columns</p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{ASSESSMENT_CSV_HEADER.join(",")}</code>
        <p className="text-xs text-muted-foreground">
          One row per assessment. <code>assessment_type</code> is one of <code>{ASSESSMENT_TYPES.join(", ")}</code> (or its display name). <code>label</code> is required for <code>other</code>.{" "}
          <code>provider</code> only when the source names one. <code>required</code> is yes/no (blank = yes). The scheme must already exist (matched by employer + scheme name), and every row carries its own source and
          dates — nothing is filled in for you. A row for an assessment the scheme already has updates it.
        </p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{EXAMPLE}</code>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assessment-csv">CSV data</Label>
        <Textarea
          id="assessment-csv"
          rows={12}
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setResult(null);
          }}
          className="font-mono text-xs"
          placeholder={`${ASSESSMENT_CSV_HEADER.join(",")}\n${EXAMPLE}`}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void run(true)} disabled={busy !== null || csvText.trim() === ""}>
          {busy === "check" ? <Loader2Icon className="animate-spin" /> : null} Check (nothing is saved)
        </Button>
        <Button onClick={() => void run(false)} disabled={busy !== null || csvText.trim() === ""}>
          {busy === "import" ? <Loader2Icon className="animate-spin" /> : null} Import
        </Button>
      </div>

      {result && "error" in result && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {result.error}
        </p>
      )}
      {result && "createdCount" in result && (
        <Card className="gap-3 p-6" data-testid="import-result">
          <p className="flex items-center gap-1.5 text-sm font-medium" role="status">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            {result.dryRun ? "Would create" : "Created"} {result.createdCount}, {result.dryRun ? "would update" : "updated"} {result.updatedCount}
            {result.errors.length > 0 ? `, ${result.errors.length} skipped` : ""}
            {result.dryRun ? " — nothing saved yet" : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {result.errors.map((rowError, index) => (
                <li key={`${rowError.rowNumber}-${index}`}>
                  Row {rowError.rowNumber}: {rowError.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
