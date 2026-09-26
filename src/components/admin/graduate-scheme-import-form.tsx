"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importGraduateSchemes, type GraduateSchemeImportResult } from "@/lib/graduate-schemes/actions";
import { GRADUATE_SCHEME_CSV_HEADER, GRADUATE_SCHEME_CSV_OPTIONAL } from "@/lib/graduate-schemes/csv";

// Placeholder values only, to show the shape of a row — never real scheme data.
const EXAMPLE_ROW = [
  "Example Employer",
  "Example Graduate Programme",
  "technology",
  "£30,000",
  "London; Leeds",
  "not_published",
  "",
  "https://example.com/graduates",
  "2026-01-15",
  "2026-01-20",
].join(",");

export function GraduateSchemeImportForm() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [result, setResult] = useState<GraduateSchemeImportResult | null>(null);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "check" : "import");
    setResult(null);
    const response = await importGraduateSchemes(csvText, { dryRun });
    setBusy(null);
    setResult(response);
    if (!dryRun && "createdCount" in response) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-3 p-6">
        <p className="text-sm font-medium">Required columns</p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{GRADUATE_SCHEME_CSV_HEADER.join(",")}</code>
        <p className="text-sm font-medium">Optional columns</p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{GRADUATE_SCHEME_CSV_OPTIONAL.join(",")}</code>
        <p className="text-xs text-muted-foreground">
          One header row, then one row per scheme. <code>locations</code>, <code>study_stages</code> and <code>assessments</code> can hold several values separated by <code>;</code>. <code>sector</code>,{" "}
          <code>sponsorship_status</code>, study stages and assessments accept the internal key (e.g. <code>numerical_test</code>) or the display label. Dates are <code>YYYY-MM-DD</code>; leave a
          date blank if the employer hasn&apos;t published it. <code>rolling</code> and <code>published</code> are yes/no. A row is matched to an existing scheme by employer + scheme name and updated in
          place — only the columns your file contains are changed. Every row needs its own source and dates; the import never fills anything in.
        </p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{EXAMPLE_ROW}</code>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="graduate-scheme-csv">CSV data</Label>
        <Textarea
          id="graduate-scheme-csv"
          rows={12}
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setResult(null);
          }}
          placeholder={`${GRADUATE_SCHEME_CSV_HEADER.join(",")}\n${EXAMPLE_ROW}`}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void run(true)} disabled={busy !== null || csvText.trim() === ""}>
          {busy === "check" ? (
            <>
              <Loader2Icon className="animate-spin" /> Checking…
            </>
          ) : (
            "Check (nothing is saved)"
          )}
        </Button>
        <Button onClick={() => void run(false)} disabled={busy !== null || csvText.trim() === ""}>
          {busy === "import" ? (
            <>
              <Loader2Icon className="animate-spin" /> Importing…
            </>
          ) : (
            "Import"
          )}
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
