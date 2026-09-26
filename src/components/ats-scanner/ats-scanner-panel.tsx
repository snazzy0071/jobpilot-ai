"use client";

import { useState } from "react";
import { Loader2Icon, AlertCircleIcon, ScanSearchIcon, HistoryIcon } from "lucide-react";
import { callAction } from "@/components/cvs/editor/call-action";
import { runAtsScan } from "@/lib/cvs/ats-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SamplePreviewCard } from "@/components/ats-scanner/sample-preview-card";
import { ScanResultCard } from "@/components/ats-scanner/scan-result-card";
import { RecommendationsCard } from "@/components/ats-scanner/recommendations-card";
import { JobDescriptionField } from "@/components/ats-scanner/job-description-field";
import { scoreTone } from "@/lib/quick-scan/score-tone";
import type { CvAtsScan, CvAtsJobOption, CvAtsFormatIssue } from "@/lib/cvs/types";

const MIN_JOB_DESCRIPTION_LENGTH = 30;

/**
 * reference/auth/ats-scanner.png's standalone scan form + result —
 * unlike the CV editor's embedded `AtsPreflightPanel`, this isn't
 * rendered inside a `CvPreviewProvider` (there's no live typing to
 * merge; the CV was already saved before you got here), and it has no
 * inline "accept AI rewrite"/"add to skills" editing actions — those
 * change the CV's actual content, which belongs in the editor. A
 * recommendation's "Fix in {section}" instead deep-links to that CV's
 * editor with the section's real anchor id in the URL hash, so the
 * browser scrolls straight to it (still collapsed if it was, but
 * visible and one click from open) rather than duplicating the editor's
 * own expand-and-scroll behaviour on a page that doesn't have that
 * CV's accordion mounted at all.
 *
 * `history` is every scan already run against this CV (most recent
 * first — the scan shown on load is always `history[0] ?? null`), so
 * "Past scans" just swaps which one is displayed, no second AI call or
 * round trip. "Re-score against this role" is the same real scan as the
 * first one — always a fresh AI call, always a new row in `history`.
 */
export function AtsScannerPanel({
  cvId,
  versionId,
  cvTitle,
  cvText,
  formatIssues,
  history,
  recentJobOptions,
}: {
  cvId: string;
  versionId: string;
  cvTitle: string;
  cvText: string;
  formatIssues: CvAtsFormatIssue[];
  history: CvAtsScan[];
  recentJobOptions: CvAtsJobOption[];
}) {
  const initialScan = history[0] ?? null;
  const [jobDescription, setJobDescription] = useState(initialScan?.jobDescription ?? "");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [scan, setScan] = useState<CvAtsScan | null>(initialScan);
  const [scanHistory, setScanHistory] = useState(history);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSelectHistoryEntry(id: string | null) {
    const entry = scanHistory.find((row) => row.id === id);
    if (entry) setScan(entry);
  }

  async function handleScan() {
    setError(null);
    const description = jobDescription.trim();
    if (description.length < MIN_JOB_DESCRIPTION_LENGTH) {
      setError("Paste the full job description first.");
      return;
    }
    if (!cvText) {
      setError("Add some content to this CV before scanning.");
      return;
    }

    setLoading(true);
    const result = await callAction(() =>
      runAtsScan({
        versionId,
        jobDescription: description,
        cvText,
        formatIssues,
        reusedFromScanId: selectedJobId || undefined,
      }),
    );
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setScan(result.scan);
    setScanHistory((current) => [result.scan, ...current]);
  }

  const isLatest = !scan || scanHistory[0]?.id === scan.id;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">ATS Scanner</h2>
        <p className="mt-1 text-muted-foreground">
          Scoring <span className="font-semibold text-foreground">{cvTitle}</span> against a job description.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paste a job description</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <JobDescriptionField
            value={jobDescription}
            onChange={setJobDescription}
            recentJobOptions={recentJobOptions}
            selectedJobId={selectedJobId}
            onSelectJob={(id) => setSelectedJobId(id ?? "")}
          />

          <Button type="button" onClick={handleScan} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" /> Scanning…
              </>
            ) : (
              <>
                <ScanSearchIcon /> {scan ? "Re-score against this role" : "Scan CV against this role"}
              </>
            )}
          </Button>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircleIcon className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {scanHistory.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ats-scan-history" className="flex items-center gap-1.5 text-sm">
            <HistoryIcon className="size-3.5" /> Past scans ({scanHistory.length})
          </Label>
          <Select value={scan?.id ?? ""} onValueChange={handleSelectHistoryEntry}>
            <SelectTrigger id="ats-scan-history" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scanHistory.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.overallScore}/100 — {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} —{" "}
                  {entry.jobDescription.slice(0, 40).replace(/\s+/g, " ")}
                  {entry.jobDescription.length > 40 ? "…" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLatest && (
            <p className="text-xs text-muted-foreground">
              Viewing an earlier scan (<span className={`font-medium ${scoreTone(scan!.overallScore)}`}>{scan!.overallScore}/100</span>). Run a
              new scan above for a current result.
            </p>
          )}
        </div>
      )}

      {scan ? <ScanResultCard scan={scan} /> : <SamplePreviewCard />}

      {scan && <RecommendationsCard scan={scan} formatIssues={formatIssues} cvId={cvId} />}
    </div>
  );
}
