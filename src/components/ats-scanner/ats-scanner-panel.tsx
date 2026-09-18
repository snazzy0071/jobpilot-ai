"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon, AlertCircleIcon, CheckCircle2Icon, LinkIcon, ScanSearchIcon } from "lucide-react";
import { callAction } from "@/components/cvs/editor/call-action";
import { runAtsScan } from "@/lib/cvs/ats-actions";
import { fetchJobDescriptionFromUrl } from "@/lib/cvs/job-url-actions";
import { buildAtsRecommendations, groupAtsRecommendations, RECOMMENDATION_GROUP_LABELS } from "@/lib/cvs/ats-recommendations";
import { sectionAnchorId } from "@/components/cvs/editor/jump-to-section";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScoreRing } from "@/components/ats-scanner/score-ring";
import { SamplePreviewCard } from "@/components/ats-scanner/sample-preview-card";
import { SECTION_LABELS } from "@/lib/cvs/types";
import type { CvAtsScan, CvAtsJobOption, CvAtsFixPriority, CvAtsFormatIssue } from "@/lib/cvs/types";

const MIN_JOB_DESCRIPTION_LENGTH = 30;

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

const PRIORITY_BADGE_VARIANT: Record<CvAtsFixPriority, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

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
 */
export function AtsScannerPanel({
  cvId,
  versionId,
  cvTitle,
  cvText,
  formatIssues,
  initialScan,
  recentJobOptions,
}: {
  cvId: string;
  versionId: string;
  cvTitle: string;
  cvText: string;
  formatIssues: CvAtsFormatIssue[];
  initialScan: CvAtsScan | null;
  recentJobOptions: CvAtsJobOption[];
}) {
  const [jobDescription, setJobDescription] = useState(initialScan?.jobDescription ?? "");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [scan, setScan] = useState<CvAtsScan | null>(initialScan);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [inputMode, setInputMode] = useState<"paste" | "url">(initialScan ? "paste" : "url");
  const [jobUrl, setJobUrl] = useState("");
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchNote, setUrlFetchNote] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const recommendationBuckets = groupAtsRecommendations(buildAtsRecommendations(formatIssues, scan));

  function handleSelectJob(id: string | null) {
    setSelectedJobId(id ?? "");
    const option = recentJobOptions.find((row) => row.id === id);
    if (option) {
      setJobDescription(option.jobDescription);
      setInputMode("paste");
    }
  }

  async function handleFetchUrl() {
    setUrlFetchNote(null);
    const url = jobUrl.trim();
    if (!url) {
      setUrlFetchNote({ tone: "error", message: "Paste a link first." });
      return;
    }

    setUrlFetchLoading(true);
    const result = await fetchJobDescriptionFromUrl({ url });
    setUrlFetchLoading(false);

    if ("error" in result) {
      setUrlFetchNote({ tone: "error", message: result.error });
      setInputMode("paste");
      return;
    }

    setJobDescription(result.jobDescription);
    setSelectedJobId("");
    const label = [result.title, result.company].filter(Boolean).join(" at ");
    setUrlFetchNote({
      tone: "success",
      message: label
        ? `Imported "${label}" — review it below before scanning.`
        : "Imported the job description below — review it before scanning.",
    });
    setInputMode("paste");
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
  }

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
          {recentJobOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Use a previous job description</Label>
              <Select value={selectedJobId} onValueChange={handleSelectJob}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a job you've scanned before" />
                </SelectTrigger>
                <SelectContent>
                  {recentJobOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.jobDescription.slice(0, 60).replace(/\s+/g, " ")}
                      {option.jobDescription.length > 60 ? "…" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "paste" | "url")}>
            <TabsList>
              <TabsTrigger value="url">Import from URL</TabsTrigger>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Input
                  id="ats-job-url"
                  type="url"
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                  placeholder="https://reed.co.uk/jobs/…"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleFetchUrl} disabled={urlFetchLoading}>
                  {urlFetchLoading ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
                  Import
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Works with LinkedIn, Glassdoor, Reed, Totaljobs, Adzuna, CV-Library and most company career sites.
                Indeed keeps its postings behind a login, so use the Paste text tab for those.
              </p>
            </TabsContent>

            <TabsContent value="paste" className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ats-job-description">
                {recentJobOptions.length > 0 ? "Or paste a job description" : "Paste a job description"}
              </Label>
              <Textarea
                id="ats-job-description"
                rows={6}
                maxLength={20000}
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  setSelectedJobId("");
                  setUrlFetchNote(null);
                }}
                placeholder="Paste the full job listing here…"
              />
            </TabsContent>
          </Tabs>

          {urlFetchNote && (
            <p
              className={`flex items-center gap-1.5 text-sm ${urlFetchNote.tone === "error" ? "text-destructive" : "text-success"}`}
              role={urlFetchNote.tone === "error" ? "alert" : "status"}
            >
              {urlFetchNote.tone === "error" ? (
                <AlertCircleIcon className="size-4 shrink-0" />
              ) : (
                <CheckCircle2Icon className="size-4 shrink-0" />
              )}
              {urlFetchNote.message}
            </p>
          )}

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

      {scan ? (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <ScoreRing score={scan.overallScore} />
              <div>
                <p className="text-sm text-muted-foreground">Overall match with this job description</p>
                <p className="text-sm">{scan.summary}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-4">
              <span>
                Keyword <span className={`block font-medium ${scoreTone(scan.keywordScore)}`}>{scan.keywordScore}</span>
              </span>
              <span>
                Structure{" "}
                <span className={`block font-medium ${scoreTone(scan.structureScore)}`}>{scan.structureScore}</span>
              </span>
              <span>
                Format <span className={`block font-medium ${scoreTone(scan.formatScore)}`}>{scan.formatScore}</span>
              </span>
              <span>
                Sections{" "}
                <span className={`block font-medium ${scoreTone(scan.sectionsScore)}`}>{scan.sectionsScore}</span>
              </span>
            </div>

            <p className="border-t pt-3 text-sm text-muted-foreground">
              Keywords matched: {scan.matchedKeywords.length} of{" "}
              {scan.matchedKeywords.length + scan.missingKeywords.length}
            </p>

            {scan.matchedKeywords.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Matched keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {scan.matchedKeywords.map((keyword) => (
                    <Badge
                      key={keyword.term}
                      variant="secondary"
                      className={`gap-1 text-success ${keyword.importance === "high" ? "font-semibold" : ""}`}
                    >
                      {keyword.term}
                      {keyword.occurrenceCount > 0 && <span className="text-success/70">×{keyword.occurrenceCount}</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {scan.strengths.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Strengths</p>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {scan.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <SamplePreviewCard />
      )}

      {scan && recommendationBuckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Apply these in the editor, then come back and re-score.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recommendationBuckets.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {RECOMMENDATION_GROUP_LABELS[group]} ({items.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm">
                      <span className="flex items-start gap-2">
                        <Badge variant={PRIORITY_BADGE_VARIANT[item.priority]} className="mt-0.5 shrink-0 capitalize">
                          {item.priority}
                        </Badge>
                        {item.message}
                      </span>
                      {item.jumpSectionKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          render={
                            <Link href={`/dashboard/cvs/${cvId}#${sectionAnchorId(item.jumpSectionKey)}`}>
                              Fix in {SECTION_LABELS[item.jumpSectionKey]}
                            </Link>
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
