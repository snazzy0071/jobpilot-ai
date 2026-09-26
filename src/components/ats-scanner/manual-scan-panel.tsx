"use client";

import { useState } from "react";
import { Loader2Icon, AlertCircleIcon, ScanSearchIcon, CheckIcon, AlertTriangleIcon } from "lucide-react";
import { callAction } from "@/components/cvs/editor/call-action";
import { runManualAtsScan } from "@/lib/cvs/ats-actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SamplePreviewCard } from "@/components/ats-scanner/sample-preview-card";
import { ScanResultCard } from "@/components/ats-scanner/scan-result-card";
import { RecommendationsCard } from "@/components/ats-scanner/recommendations-card";
import { JobDescriptionField } from "@/components/ats-scanner/job-description-field";
import type { ManualAtsScan, CvAtsJobOption } from "@/lib/cvs/types";

const MIN_JOB_DESCRIPTION_LENGTH = 30;

/**
 * The ATS Scanner's other entry point (`runManualAtsScan`): a CV that isn't saved in the builder — an
 * uploaded PDF/DOCX/text file, or CV text pasted directly. Same real scoring (`ScanResultCard`) and
 * recommendations (`RecommendationsCard`, with no `cvId` — there's no CV to deep-link a fix into) as the
 * saved-CV panel, plus its own "File format checks" card for an uploaded file's real structural findings
 * (embedded fonts, tables, columns...), which the AI scan never sees. No scan history here: each upload is
 * a one-off, there's no stable CV identity to accumulate a history against.
 */
export function ManualScanPanel({ recentJobOptions }: { recentJobOptions: CvAtsJobOption[] }) {
  const [cvSource, setCvSource] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [scan, setScan] = useState<ManualAtsScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleScan() {
    setError(null);
    const description = jobDescription.trim();
    if (description.length < MIN_JOB_DESCRIPTION_LENGTH) {
      setError("Paste the full job description first.");
      return;
    }
    if (cvSource === "file" && !file) {
      setError("Choose a CV file to upload.");
      return;
    }
    if (cvSource === "text" && !pastedText.trim()) {
      setError("Paste your CV text first.");
      return;
    }

    const formData = new FormData();
    formData.set("jobDescription", description);
    if (selectedJobId) formData.set("reusedFromScanId", selectedJobId);
    if (cvSource === "file" && file) formData.set("file", file);
    else formData.set("cvText", pastedText);

    setLoading(true);
    const result = await callAction(() => runManualAtsScan(formData));
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
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Scan a file</h2>
        <p className="mt-1 text-muted-foreground">
          Upload a CV as a PDF, DOCX or plain text file, or paste its text directly — no need to build it in the CV
          editor first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your CV</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={cvSource} onValueChange={(value) => setCvSource(value as "file" | "text")}>
            <TabsList>
              <TabsTrigger value="file">Upload a CV file</TabsTrigger>
              <TabsTrigger value="text">Paste CV text</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ats-manual-file">PDF, DOCX or plain text — up to 10MB</Label>
              <Input
                id="ats-manual-file"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </TabsContent>

            <TabsContent value="text" className="flex flex-col gap-2 pt-2">
              <Label htmlFor="ats-manual-text">Your CV, as plain text</Label>
              <Textarea
                id="ats-manual-text"
                rows={8}
                maxLength={12000}
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder="Paste your CV's text here…"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
                <ScanSearchIcon /> Scan this CV
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

      {scan ? <ScanResultCard scan={scan} /> : <SamplePreviewCard />}

      {scan?.fileFormatChecks && scan.fileFormatChecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File format checks</CardTitle>
            <CardDescription>Real structural facts read from the file itself — a separate signal from the score above.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {scan.fileFormatChecks.map((check) => (
                <li key={check.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                  {check.passed ? (
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <AlertTriangleIcon className={`mt-0.5 size-4 shrink-0 ${check.severity === "warning" ? "text-warning" : "text-muted-foreground"}`} aria-hidden />
                  )}
                  {check.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {scan && <RecommendationsCard scan={scan} cvId={null} />}
    </div>
  );
}
