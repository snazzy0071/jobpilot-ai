"use client";

import { useState } from "react";
import { Loader2Icon, AlertCircleIcon, CheckCircle2Icon, LinkIcon } from "lucide-react";
import { fetchJobDescriptionFromUrl } from "@/lib/cvs/job-url-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { CvAtsJobOption } from "@/lib/cvs/types";

/** The label shown for a previous scan's job description, both in the closed trigger and the open list — one place so they can't drift. */
function jobOptionLabel(option: CvAtsJobOption): string {
  const snippet = option.jobDescription.slice(0, 60).replace(/\s+/g, " ");
  return option.jobDescription.length > 60 ? `${snippet}…` : snippet;
}

/**
 * The job-description half of a scan — paste it, import it from a URL (the same SSRF-safe fetch and
 * extractor either scan entry point uses), or reuse one already scanned before. Shared by both ATS Scanner
 * panels so the two never drift: `value`/`onChange` and the "previous job description" selection are
 * lifted to the caller (the scan action needs both), the URL-import UI's own busy/error state stays local
 * here since nothing outside this field needs it.
 */
export function JobDescriptionField({
  value,
  onChange,
  recentJobOptions,
  selectedJobId,
  onSelectJob,
}: {
  value: string;
  onChange: (value: string) => void;
  recentJobOptions: CvAtsJobOption[];
  selectedJobId: string;
  onSelectJob: (id: string | null) => void;
}) {
  // Paste is the default either way, even before there's any value typed yet — the same default the CV editor's
  // own embedded ATS panel already uses. The field used to open on the URL-import tab until an existing scan gave
  // it something to show, which meant a first scan started on an empty URL box with the simpler paste option
  // hidden behind an extra click.
  const [inputMode, setInputMode] = useState<"paste" | "url">("paste");
  const [jobUrl, setJobUrl] = useState("");
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchNote, setUrlFetchNote] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function handleSelectJob(id: string | null) {
    onSelectJob(id);
    const option = recentJobOptions.find((row) => row.id === id);
    if (option) {
      onChange(option.jobDescription);
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

    onChange(result.jobDescription);
    onSelectJob(null);
    const label = [result.title, result.company].filter(Boolean).join(" at ");
    setUrlFetchNote({
      tone: "success",
      message: label
        ? `Imported "${label}" — review it below before scanning.`
        : "Imported the job description below — review it before scanning.",
    });
    setInputMode("paste");
  }

  return (
    <div className="flex flex-col gap-4">
      {recentJobOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Use a previous job description</Label>
          <Select items={Object.fromEntries(recentJobOptions.map((option) => [option.id, jobOptionLabel(option)]))} value={selectedJobId} onValueChange={handleSelectJob}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a job you've scanned before" />
            </SelectTrigger>
            <SelectContent>
              {recentJobOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {jobOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={inputMode} onValueChange={(next) => setInputMode(next as "paste" | "url")}>
        <TabsList>
          <TabsTrigger value="url">Import from URL</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <Input
              type="url"
              value={jobUrl}
              onChange={(event) => setJobUrl(event.target.value)}
              placeholder="https://reed.co.uk/jobs/…"
              className="flex-1"
              aria-label="Job posting link"
            />
            <Button type="button" variant="outline" onClick={handleFetchUrl} disabled={urlFetchLoading}>
              {urlFetchLoading ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
              Import
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Works with LinkedIn, Glassdoor, Reed, Totaljobs, Adzuna, CV-Library and most company career sites. Indeed
            keeps its postings behind a login, so use the Paste text tab for those.
          </p>
        </TabsContent>

        <TabsContent value="paste" className="flex flex-col gap-2 pt-2">
          <Label htmlFor="ats-job-description">{recentJobOptions.length > 0 ? "Or paste a job description" : "Paste a job description"}</Label>
          <Textarea
            id="ats-job-description"
            rows={6}
            maxLength={20000}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              onSelectJob(null);
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
          {urlFetchNote.tone === "error" ? <AlertCircleIcon className="size-4 shrink-0" /> : <CheckCircle2Icon className="size-4 shrink-0" />}
          {urlFetchNote.message}
        </p>
      )}
    </div>
  );
}
