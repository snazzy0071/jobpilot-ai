"use client";

import { useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importGraduateSchemes, type GraduateSchemeImportResult } from "@/lib/graduate-schemes/actions";
import { GRADUATE_SCHEME_CSV_HEADER } from "@/lib/graduate-schemes/csv";

const EXAMPLE_ROW = [
  "Deloitte",
  "Technology Consulting Graduate Programme",
  "consulting",
  "£32,000",
  "London; Manchester",
  "sponsors",
  "Confirmed on the graduate careers site.",
  "https://example.com/careers/graduates",
  "2026-06-01",
  "2026-09-01",
].join(",");

export function GraduateSchemeImportForm() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraduateSchemeImportResult | null>(null);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    const response = await importGraduateSchemes(csvText);
    setLoading(false);
    setResult(response);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-3 p-6">
        <p className="text-sm font-medium">Expected columns</p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {GRADUATE_SCHEME_CSV_HEADER.join(",")}
        </code>
        <p className="text-xs text-muted-foreground">
          One header row, then one row per scheme. <code>locations</code> can hold more than one
          value, separated by <code>;</code>. <code>sector</code> and <code>sponsorship_status</code> accept
          either the internal key (e.g. <code>technology</code>) or the display label (e.g.{" "}
          <code>Technology</code>). Dates are <code>YYYY-MM-DD</code>. A row is matched to an
          existing scheme by employer + scheme name, and updated in place rather than duplicated.
        </p>
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{EXAMPLE_ROW}</code>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="graduate-scheme-csv">CSV data</Label>
        <Textarea
          id="graduate-scheme-csv"
          rows={12}
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder={`${GRADUATE_SCHEME_CSV_HEADER.join(",")}\n${EXAMPLE_ROW}`}
          className="font-mono text-xs"
        />
      </div>

      <div>
        <Button onClick={handleImport} disabled={loading || csvText.trim() === ""}>
          {loading ? (
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
        <Card className="gap-3 p-6">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            {result.createdCount} created, {result.updatedCount} updated
            {result.errors.length > 0 ? `, ${result.errors.length} skipped` : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {result.errors.map((rowError) => (
                <li key={rowError.rowNumber}>
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
